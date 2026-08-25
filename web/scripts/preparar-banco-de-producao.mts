/**
 * Leva os dados da Avanz para o banco de produção — em duas etapas, porque uma
 * delas exige superusuário e não é nossa para automatizar.
 *
 *   npx tsx --env-file=.env.local scripts/preparar-banco-de-producao.mts
 *   npx tsx --env-file=.env.local scripts/preparar-banco-de-producao.mts --conferir
 *
 * Sem argumento, ele confere o terreno e **imprime o comando** da cópia. Com
 * `--conferir`, ele arruma o que sobrou e valida contagem por contagem contra a
 * origem.
 *
 * ## Por que a cópia precisa de superusuário
 *
 * As tabelas têm `FORCE ROW LEVEL SECURITY`, que sujeita **até o dono** à
 * política. Um `pg_dump` como `radar_owner` falha com "query would be affected
 * by row-level security policy" — e essa falha é fácil de engolir, porque num
 * `pg_dump | psql` o status do pipeline é o do `psql`, que carrega o pedaço que
 * chegou e sai feliz. Foi assim que a primeira tentativa criou 22 tabelas
 * vazias e disse que tinha dado certo.
 *
 * `--enable-row-security` não resolve: o `pg_dump` não leva a variável de
 * sessão que as políticas consultam, então devolve zero linhas em silêncio.
 * Superusuário ignora RLS e é o único caminho honesto.
 *
 * ## E isto vale para o backup
 *
 * Qualquer cópia deste banco feita como `radar_owner` sai **vazia ou quebrada**.
 * Backup que ninguém confere é backup que não existe — o mesmo cuidado daqui
 * precisa estar em quem agendar a rotina.
 */

import { Pool } from "pg";

const BANCO = "radar_prod";
const ORIGEM = "radar_dev";
/** O único ambiente que vai para produção agora. */
const MANTER = "avanz-imoveis";

/** Tabelas append-only: o `GRANT ... ON ALL` desfaz o `REVOKE` da migração. */
const APPEND_ONLY = ["evento", "consumo"];

const conferir = process.argv.includes("--conferir");

function paraBanco(url: string, banco: string): string {
  const u = new URL(url);
  u.pathname = `/${banco}`;
  return u.toString();
}

const doDono = process.env.DATABASE_URL_MIGRATIONS;
const doApp = process.env.DATABASE_URL;
if (!doDono || !doApp) {
  console.error("faltam DATABASE_URL e DATABASE_URL_MIGRATIONS");
  process.exit(1);
}

const donoProd = paraBanco(doDono, BANCO);
const donoDev = paraBanco(doDono, ORIGEM);
const papelApp = new URL(doApp).username;

async function abrir(url: string): Promise<Pool> {
  const pool = new Pool({ connectionString: url });
  await pool.query("select 1");
  return pool;
}

/** Conta as linhas de um ambiente, com a política satisfeita. */
async function contar(pool: Pool, ambienteId: string) {
  const tabelas = [
    "brief",
    "evento",
    "pilar",
    "publico",
    "fonte",
    "vault_bloco",
  ];
  const saida: Record<string, number> = {};
  const cliente = await pool.connect();
  try {
    await cliente.query("begin");
    await cliente.query("select set_config('app.ambiente', $1, true)", [
      ambienteId,
    ]);
    for (const t of tabelas) {
      const { rows } = await cliente.query(
        `select count(*)::int as n from ${t}`,
      );
      saida[t] = rows[0].n;
    }
    await cliente.query("commit");
  } finally {
    cliente.release();
  }
  return saida;
}

const dev = await abrir(donoDev).catch((e: Error) => {
  console.error(`não abri ${ORIGEM}: ${e.message}`);
  process.exit(1);
});

const [{ id: idNaOrigem }] = (
  await dev.query<{ id: string }>("select id from ambiente where slug = $1", [
    MANTER,
  ])
).rows;
const naOrigem = await contar(dev, idNaOrigem);
await dev.end();

const prod = await abrir(donoProd).catch((e: Error) => {
  console.error(
    `não abri ${BANCO}: ${e.message}\n\n` +
      `  sudo -u postgres psql -c 'CREATE DATABASE ${BANCO} OWNER radar_owner'`,
  );
  process.exit(1);
});

const { rows: tabelas } = await prod.query<{ n: number }>(
  "select count(*)::int as n from information_schema.tables where table_schema='public'",
);

if (!conferir) {
  await prod.end();
  console.log(`\nNa origem (${ORIGEM}), ${MANTER} tem:`);
  for (const [t, n] of Object.entries(naOrigem)) console.log(`  ${t}: ${n}`);

  if (tabelas[0].n > 0) {
    console.log(
      // Pelo superusuário e sem a URL: imprimir a de dono poria a senha no
      // terminal e no histórico do shell.
      `\n⚠ ${BANCO} já tem ${tabelas[0].n} tabelas. Se vieram de uma tentativa\n` +
        `  incompleta, esvazie antes — copiar por cima mistura os dois:\n\n` +
        `  sudo -u postgres psql -d ${BANCO} -c 'drop schema public cascade; create schema public;'\n`,
    );
  }

  console.log(
    `\nA cópia roda como superusuário, porque FORCE RLS esconde as linhas até\n` +
      `do dono. Rode, e repare no \`set -o pipefail\` — sem ele um pg_dump que\n` +
      `falha passa despercebido:\n\n` +
      `  sudo -u postgres bash -c 'set -o pipefail; pg_dump ${ORIGEM} | psql -q -v ON_ERROR_STOP=1 ${BANCO}'\n\n` +
      `Depois, confira e arrume o resto:\n\n` +
      `  npx tsx --env-file=.env.local scripts/preparar-banco-de-producao.mts --conferir\n`,
  );
  process.exit(0);
}

/* ── conferência e arremate ─────────────────────────────────────────────── */

if (tabelas[0].n === 0) {
  console.error(
    `${BANCO} está vazio — a cópia não rodou. Veja o comando acima.`,
  );
  process.exit(1);
}

const { rows: ambientes } = await prod.query<{ slug: string; id: string }>(
  "select slug, id from ambiente order by slug",
);
for (const a of ambientes) {
  if (a.slug !== MANTER) {
    await prod.query("delete from ambiente where id = $1", [a.id]);
    console.log(`removido: ${a.slug}`);
  }
}

await prod.query(`GRANT USAGE ON SCHEMA public TO ${papelApp}`);
await prod.query(
  `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${papelApp}`,
);
await prod.query(
  `GRANT SELECT, USAGE ON ALL SEQUENCES IN SCHEMA public TO ${papelApp}`,
);
for (const t of APPEND_ONLY) {
  await prod.query(`REVOKE UPDATE, DELETE ON TABLE "${t}" FROM ${papelApp}`);
}

const alvo = ambientes.find((a) => a.slug === MANTER);
if (!alvo) {
  console.error(`${MANTER} não chegou em ${BANCO} — a cópia veio incompleta.`);
  process.exit(1);
}
const noDestino = await contar(prod, alvo.id);

const { rows: forca } = await prod.query<{ n: number }>(
  `select count(*)::int as n from pg_class
   where relnamespace='public'::regnamespace and relkind='r'
     and relrowsecurity and relforcerowsecurity`,
);
await prod.end();

/**
 * A conferência é o ponto deste script.
 *
 * A primeira versão imprimiu "pronto" com base em consultas que também passavam
 * pelo RLS — mediu o próprio ponto cego. Aqui a origem e o destino são contados
 * do mesmo jeito, e divergir é falha.
 */
let divergiu = false;
console.log(`\n${ORIGEM} → ${BANCO}, ${MANTER}:`);
for (const [t, n] of Object.entries(naOrigem)) {
  const d = noDestino[t] ?? 0;
  const ok = d === n;
  if (!ok) divergiu = true;
  console.log(`  ${ok ? "ok " : "DIF"} ${t}: ${n} → ${d}`);
}

if (forca[0].n === 0) {
  divergiu = true;
  console.log(`  DIF nenhuma tabela com RLS + FORCE — as políticas não vieram`);
} else {
  console.log(`  ok  ${forca[0].n} tabelas com RLS + FORCE`);
}

if (divergiu) {
  console.error(
    `\nA cópia não bate com a origem. Não aponte nada para ${BANCO} ainda.\n`,
  );
  process.exit(1);
}

console.log(
  `\nConfere. Falta, e não é deste script: backup, segredos, e apontar a app\n` +
    `e o trabalhador para ${BANCO}.\n`,
);
