/**
 * Prepara o banco de produção e leva os dados da Avanz para ele.
 *
 *   npx tsx --env-file=.env.local scripts/preparar-banco-de-producao.mts
 *   npx tsx --env-file=.env.local scripts/preparar-banco-de-producao.mts --executar
 *
 * Sem `--executar` ele só **relata** o que faria. Mover dado de cliente merece
 * ser lido antes de acontecer.
 *
 * O banco precisa existir antes — `radar_owner` não cria banco, e criar exige
 * superusuário:
 *
 *   sudo -u postgres psql -c 'CREATE DATABASE radar_prod OWNER radar_owner'
 *
 * ## Como os dados chegam lá
 *
 * Cópia integral do `radar_dev` e **remoção do que não é a Avanz**, em vez de
 * exportar linha a linha. Não é preguiça: são dezessete tabelas com chaves
 * compostas e RLS, e um export seletivo erra na ordem ou esquece uma tabela
 * nova sem ninguém notar. Apagar ambiente é uma operação, e a cascata resolve o
 * resto — a mesma cascata que já se usa para excluir cliente.
 *
 * ## O que este script **não** faz, e é decisão sua
 *
 * - **Backup.** Nada aqui agenda cópia. Banco de produção sem backup é banco de
 *   produção até o primeiro acidente.
 * - **Segredos.** `SESSION_SECRET`, credenciais do Postgres e do Cloudinary
 *   precisam vir de algum lugar que não seja o `.env.local` da sua máquina.
 * - **Apontar a app e o trabalhador** para cá. Enquanto o `.env` de produção
 *   não existir, isto é só um banco cheio esperando.
 * - **Apagar o `radar_dev`.** Ele continua sendo a cópia de trabalho.
 */

import { Pool } from "pg";
import { execFileSync } from "node:child_process";

const BANCO = "radar_prod";
const ORIGEM = "radar_dev";
/** O único ambiente que vai para produção agora. */
const MANTER = ["avanz-imoveis"];

const executar = process.argv.includes("--executar");

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
const papelApp = new URL(doApp).username;

const sonda = new Pool({ connectionString: donoProd });
try {
  await sonda.query("select 1");
} catch (erro) {
  console.error(
    `não consegui abrir ${BANCO}: ${(erro as Error).message}\n\n` +
      `Crie-o com superusuário:\n` +
      `  sudo -u postgres psql -c 'CREATE DATABASE ${BANCO} OWNER radar_owner'`,
  );
  process.exit(1);
}

const { rows: jaTem } = await sonda.query<{ n: number }>(
  "select count(*)::int as n from information_schema.tables where table_schema='public'",
);
await sonda.end();

if (jaTem[0].n > 0) {
  console.error(
    `${BANCO} já tem ${jaTem[0].n} tabelas — este script é para o primeiro\n` +
      `povoamento. Repetir sobre um banco em uso apagaria dado de produção.`,
  );
  process.exit(1);
}

/** O que será removido depois da cópia. */
const origem = new Pool({ connectionString: paraBanco(doDono, ORIGEM) });
const { rows: ambientes } = await origem.query<{ slug: string }>(
  "select slug from ambiente order by slug",
);
await origem.end();

const remover = ambientes.map((a) => a.slug).filter((s) => !MANTER.includes(s));

console.log(`\nDe ${ORIGEM} para ${BANCO}:`);
console.log(`  mantém  → ${MANTER.join(", ")}`);
console.log(`  remove  → ${remover.join(", ") || "(nada)"}`);
console.log(`  papel da aplicação → ${papelApp}`);

if (!executar) {
  console.log(`\nEnsaio. Para valer: acrescente --executar\n`);
  process.exit(0);
}

console.log(`\ncopiando…`);
// `pg_dump | psql` em vez de export por tabela: a ordem das chaves e as
// políticas de RLS vêm junto, e é o caminho que o Postgres garante.
const dump = execFileSync(
  "bash",
  [
    "-c",
    `pg_dump "${paraBanco(doDono, ORIGEM)}" | psql "${donoProd}" -q -v ON_ERROR_STOP=1`,
  ],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
);
if (dump.trim()) console.log(dump.trim());

const prod = new Pool({ connectionString: donoProd });
for (const slug of remover) {
  await prod.query("delete from ambiente where slug = $1", [slug]);
  console.log(`  removido: ${slug}`);
}

/**
 * As concessões do papel da aplicação, e os REVOKE que elas desfazem.
 *
 * Mesma lista do banco de teste, pelo mesmo motivo: `evento` e `consumo` são
 * append-only, e um `GRANT ... ON ALL TABLES` devolve o que a migração tirou.
 */
await prod.query(`GRANT USAGE ON SCHEMA public TO ${papelApp}`);
await prod.query(
  `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${papelApp}`,
);
await prod.query(
  `GRANT SELECT, USAGE ON ALL SEQUENCES IN SCHEMA public TO ${papelApp}`,
);
for (const tabela of ["evento", "consumo"]) {
  await prod.query(
    `REVOKE UPDATE, DELETE ON TABLE "${tabela}" FROM ${papelApp}`,
  );
}

const { rows: conferencia } = await prod.query<{
  slug: string;
  briefs: number;
}>(
  `select a.slug, (select count(*)::int from brief b where b.ambiente_id = a.id) as briefs
   from ambiente a order by a.slug`,
);
const { rows: forca } = await prod.query<{ n: number }>(
  `select count(*)::int as n from pg_class
   where relnamespace='public'::regnamespace and relkind='r'
     and relrowsecurity and relforcerowsecurity`,
);
await prod.end();

console.log(`\n${BANCO} pronto:`);
for (const linha of conferencia) {
  console.log(`  ${linha.slug} — ${linha.briefs} briefs`);
}
console.log(`  ${forca[0].n} tabelas com RLS + FORCE`);
console.log(
  `\nFalta, e não é deste script: backup, segredos, e apontar a app e o\n` +
    `trabalhador para ${BANCO}.\n`,
);
