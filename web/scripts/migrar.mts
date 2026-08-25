/**
 * Aplica as migrações e **mostra o erro** quando alguma falha.
 *
 *   node --env-file=.env.local     node_modules/.bin/tsx scripts/migrar.mts
 *   node --env-file=.env.producao  node_modules/.bin/tsx scripts/migrar.mts
 *
 * O `drizzle-kit migrate` sai com código 1 e imprime apenas o cabeçalho: a
 * mensagem do Postgres — a linha que diz *qual* restrição quebrou, em que
 * arquivo — é engolida. Quem roda vê "applying migrations..." e um prompt de
 * volta, e precisa ir ao banco descobrir que nada foi aplicado.
 *
 * Num terminal isso é chateação. Num deploy é a falha silenciosa de sempre:
 * exit code que ninguém confere, e um banco atrás do código sem nada dizendo.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import path from "node:path";

const url = process.env.DATABASE_URL_MIGRATIONS;
if (!url) {
  console.error(
    "DATABASE_URL_MIGRATIONS ausente — rode com --env-file=.env.local ou .env.producao",
  );
  process.exit(1);
}

const alvo = new URL(url);
console.log(`migrando ${alvo.pathname.slice(1)} como ${alvo.username}`);

const pool = new Pool({ connectionString: url });
const antes = await pool
  .query<{ n: number }>("select count(*)::int as n from drizzle.__drizzle_migrations")
  .then((r) => r.rows[0].n)
  // Banco novo ainda não tem a tabela de controle.
  .catch(() => 0);

try {
  await migrate(drizzle(pool), {
    migrationsFolder: path.join(import.meta.dirname, "..", "db", "migrations"),
  });
} catch (erro) {
  /**
   * O drizzle embrulha o erro do driver e põe o SQL inteiro na `message`. A
   * frase útil — a do `RAISE EXCEPTION`, ou "permission denied for table x" —
   * fica na `cause`. Imprimir a de fora sepulta a de dentro em trinta linhas
   * de SQL, que é quase tão ruim quanto não imprimir nada.
   */
  interface DoPostgres {
    message?: string;
    detail?: string;
    hint?: string;
  }
  const e = erro as DoPostgres & { cause?: DoPostgres };
  const raiz = e.cause ?? e;
  console.error(`\nfalhou: ${raiz.message ?? erro}`);
  if (raiz.detail) console.error(`  detalhe: ${raiz.detail}`);
  if (raiz.hint) console.error(`  dica: ${raiz.hint}`);
  await pool.end();
  process.exit(1);
}

const depois = await pool.query<{ n: number }>(
  "select count(*)::int as n from drizzle.__drizzle_migrations",
);
await pool.end();

const aplicadas = depois.rows[0].n - antes;
console.log(
  aplicadas === 0
    ? "nada a aplicar — o banco já estava em dia"
    : `${aplicadas} migração(ões) aplicada(s), ${depois.rows[0].n} no total`,
);
