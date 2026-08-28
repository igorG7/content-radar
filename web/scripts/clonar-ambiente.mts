/**
 * Cria um ambiente novo com a configuração de outro — sem levar o trabalho.
 *
 *   node --env-file=.env.local node_modules/.bin/tsx scripts/clonar-ambiente.mts \
 *     --de=avanz-imoveis --nome="Cliente Teste" --email=teste@exemplo.com.br --senha=...
 *
 * ## O que viaja, e o que não
 *
 * Viaja a **configuração**: vault, pilares, públicos, fontes, escopos de busca,
 * guardrails, banco de temas, marca e os pesos do matcher. É o que descreve como
 * o cliente pensa.
 *
 * Não viajam briefs, scans, eventos, conversas nem consumo — isso é história de
 * quem a produziu, e copiá-la faria a anti-repetição do ambiente novo pular
 * pautas que ele nunca publicou.
 *
 * O histórico de versões do vault também fica: ele aponta para o autor de cada
 * edição, um usuário que não existe do outro lado.
 *
 * ## Por que duas transações
 *
 * O RLS não deixa ler dois ambientes de uma vez, e isso vale **também para o
 * dono** — as tabelas têm FORCE. Então lê-se com `app.ambiente` na origem,
 * guarda-se em memória, e escreve-se com `app.ambiente` no destino. Não é
 * contorno: é a mesma porta que a aplicação usa, e por isso o script não
 * consegue vazar de um cliente para outro por engano.
 */

import { Pool } from "pg";
import { provisionar } from "../db/provisionar";
import { slugDoNome } from "../lib/slug";

/** Configuração, na ordem em que as chaves estrangeiras exigem. */
const TABELAS = [
  "config",
  "marca",
  "escopo_busca",
  "pilar",
  "escopo_pilar",
  "publico",
  "fonte",
  "guardrail",
  "tema",
  "vault_bloco",
] as const;

/** O provisionamento já cria estas — copiar por cima em vez de inserir. */
const JA_EXISTEM = new Set(["config", "marca", "vault_bloco"]);

/**
 * Colunas que descrevem **uso**, não configuração: viajam como nulas.
 *
 * `tema.usado_em` e `tema.esgotado_em` dizem que aquele tema já virou pauta —
 * história de quem o gastou. Copiados, o ambiente novo nasceria com temas
 * marcados como usados sem nunca ter publicado nada, e o banco de temas
 * chegaria menor do que é. Hoje seria inofensivo, porque a Avanz tem 0 de 135
 * gastos; é o tipo de coisa que só cobra quando a origem já rodou um tempo.
 */
const ZERAR: Record<string, string[]> = {
  tema: ["usado_em", "esgotado_em"],
};

function arg(nome: string): string | undefined {
  const p = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return p?.slice(nome.length + 3);
}

const de = arg("de") ?? "avanz-imoveis";
const nome = arg("nome");
const email = arg("email");
const senha = arg("senha");

if (!nome || !email || !senha) {
  console.error(
    "uso: --nome=\"Empresa\" --email=... --senha=... [--de=avanz-imoveis]",
  );
  process.exit(1);
}

const urlDono = process.env.DATABASE_URL_MIGRATIONS;
if (!urlDono) {
  console.error("DATABASE_URL_MIGRATIONS ausente — rode com --env-file");
  process.exit(1);
}

const pool = new Pool({ connectionString: urlDono });

async function idDoSlug(slug: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    "select id from ambiente where slug = $1",
    [slug],
  );
  if (!rows[0]) throw new Error(`ambiente "${slug}" não existe`);
  return rows[0].id;
}

/** Colunas da tabela, menos `ambiente_id`, que é reescrito no destino. */
async function colunas(tabela: string): Promise<string[]> {
  const { rows } = await pool.query<{ column_name: string }>(
    `select column_name from information_schema.columns
      where table_schema = 'public' and table_name = $1 and column_name <> 'ambiente_id'
      order by ordinal_position`,
    [tabela],
  );
  return rows.map((r) => r.column_name);
}

const origem = await idDoSlug(de);

/* ── leitura, no escopo da origem ────────────────────────────────────────── */

const lido = new Map<string, Record<string, unknown>[]>();
const cliente = await pool.connect();
try {
  await cliente.query("begin");
  await cliente.query("select set_config('app.ambiente', $1, true)", [origem]);
  for (const tabela of TABELAS) {
    const { rows } = await cliente.query(`select * from "${tabela}"`);
    lido.set(tabela, rows);
  }
  await cliente.query("commit");
} finally {
  cliente.release();
}

console.log(`lido de ${de}:`);
for (const [t, r] of lido) console.log(`  ${t}: ${r.length}`);

/* ── o ambiente novo ─────────────────────────────────────────────────────── */

const novo = await provisionar(
  { slug: slugDoNome(nome), nome, email, senha },
  urlDono,
);
console.log(`\nprovisionado: ${novo.slug} (${novo.ambienteId})`);

/* ── escrita, no escopo do destino ───────────────────────────────────────── */

const escritor = await pool.connect();
let gravadas = 0;
try {
  await escritor.query("begin");
  await escritor.query("select set_config('app.ambiente', $1, true)", [
    novo.ambienteId,
  ]);

  for (const tabela of TABELAS) {
    const linhas = lido.get(tabela) ?? [];
    if (linhas.length === 0) continue;
    const cols = await colunas(tabela);

    /**
     * O provisionamento já criou `config`, `marca` e os blocos vazios do vault.
     * Apagar antes de inserir mantém uma escrita só, em vez de um upsert por
     * tabela — e o destino é recém-criado, então não há o que preservar.
     */
    if (JA_EXISTEM.has(tabela)) {
      await escritor.query(`delete from "${tabela}"`);
    }

    const nomes = ["ambiente_id", ...cols].map((c) => `"${c}"`).join(", ");
    const marcadores = cols.map((_, i) => `$${i + 2}`).join(", ");
    for (const linha of linhas) {
      await escritor.query(
        `insert into "${tabela}" (${nomes}) values ($1, ${marcadores})`,
        [
          novo.ambienteId,
          ...cols.map((c) =>
            ZERAR[tabela]?.includes(c) ? null : linha[c],
          ),
        ],
      );
      gravadas++;
    }
    console.log(`  ${tabela}: ${linhas.length} copiada(s)`);
  }

  await escritor.query("commit");
} catch (erro) {
  await escritor.query("rollback");
  console.error(`\nfalhou, e nada foi gravado: ${(erro as Error).message}`);
  await escritor.release();
  await pool.end();
  process.exit(1);
} finally {
  escritor.release();
}

/* ── conferência ─────────────────────────────────────────────────────────── */

const conf = await pool.connect();
let divergiu = false;
try {
  await conf.query("begin");
  await conf.query("select set_config('app.ambiente', $1, true)", [
    novo.ambienteId,
  ]);
  console.log("");
  for (const tabela of TABELAS) {
    const esperado = (lido.get(tabela) ?? []).length;
    const { rows } = await conf.query<{ n: number }>(
      `select count(*)::int as n from "${tabela}"`,
    );
    const ok = rows[0].n === esperado;
    if (!ok) divergiu = true;
    console.log(`  ${ok ? "ok " : "DIF"} ${tabela}: ${esperado} → ${rows[0].n}`);
  }

  /** O ambiente novo nasce sem trabalho — copiar briefs faria a
   *  anti-repetição pular pautas que ele nunca publicou. */
  const { rows: vazio } = await conf.query<{ n: number }>(
    "select count(*)::int as n from brief",
  );
  const ok = vazio[0].n === 0;
  if (!ok) divergiu = true;
  console.log(`  ${ok ? "ok " : "DIF"} brief: 0 (configuração, não trabalho)`);
  await conf.query("commit");
} finally {
  conf.release();
}

await pool.end();

if (divergiu) {
  console.error(`\nA cópia não bate com a origem.\n`);
  process.exit(1);
}
console.log(
  `\n${gravadas} linha(s). Entre com ${email} e a senha que você passou.\n`,
);
