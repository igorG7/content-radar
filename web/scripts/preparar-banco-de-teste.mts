/**
 * Prepara o banco que a suíte usa.
 *
 *   npx tsx --env-file=.env.local scripts/preparar-banco-de-teste.mts
 *
 * O banco em si precisa existir antes — `radar_owner` não tem permissão para
 * criar, e criar exige superusuário:
 *
 *   sudo -u postgres psql -c 'CREATE DATABASE radar_teste OWNER radar_owner'
 *
 * O resto é feito aqui: as permissões de `radar_app` e as migrações. As
 * migrações rodam o mesmo caminho que produção roda — assim o esquema de teste
 * não é uma versão paralela que diverge sem ninguém notar.
 */

import { Pool } from "pg";
import { execFileSync } from "node:child_process";

const BANCO = "radar_teste";

function paraTeste(url: string): string {
  const u = new URL(url);
  u.pathname = `/${BANCO}`;
  return u.toString();
}

const doDono = process.env.DATABASE_URL_MIGRATIONS;
const doApp = process.env.DATABASE_URL;
if (!doDono || !doApp) {
  console.error("faltam DATABASE_URL e DATABASE_URL_MIGRATIONS");
  process.exit(1);
}

const donoTeste = paraTeste(doDono);
const appTeste = paraTeste(doApp);

const pool = new Pool({ connectionString: donoTeste });

try {
  await pool.query("select 1");
} catch (erro) {
  console.error(
    `não consegui abrir ${BANCO}: ${(erro as Error).message}\n\n` +
      `Se o banco não existe, crie-o com superusuário:\n` +
      `  sudo -u postgres psql -c 'CREATE DATABASE ${BANCO} OWNER radar_owner'`,
  );
  process.exit(1);
}

const papelApp = new URL(appTeste).username;

/**
 * As mesmas concessões que o banco de desenvolvimento recebeu à mão quando foi
 * criado. Ficam aqui para o banco de teste não depender de alguém lembrar —
 * sem elas o RLS funcionaria, mas `radar_app` não enxergaria tabela nenhuma, e
 * o sintoma seria "teste falha" em vez de "faltou permissão".
 */
await pool.query(`GRANT USAGE ON SCHEMA public TO ${papelApp}`);
await pool.query(
  `ALTER DEFAULT PRIVILEGES IN SCHEMA public
   GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${papelApp}`,
);
await pool.query(
  `ALTER DEFAULT PRIVILEGES IN SCHEMA public
   GRANT SELECT, USAGE ON SEQUENCES TO ${papelApp}`,
);
await pool.end();

console.log(`permissões de ${papelApp} concedidas em ${BANCO}`);

execFileSync("npx", ["drizzle-kit", "migrate"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL_MIGRATIONS: donoTeste },
});

/** As tabelas já existentes precisam da concessão — o default só vale para as futuras. */
const depois = new Pool({ connectionString: donoTeste });
await depois.query(
  `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${papelApp}`,
);
await depois.query(
  `GRANT SELECT, USAGE ON ALL SEQUENCES IN SCHEMA public TO ${papelApp}`,
);

/**
 * O ledger é append-only também no teste: sem isto, um teste poderia apagar
 * evento e passar, escondendo que a proteção existe (migração 0001).
 */
await depois.query(`REVOKE UPDATE, DELETE ON TABLE "evento" FROM ${papelApp}`);

const { rows } = await depois.query(
  "select count(*)::int as n from information_schema.tables where table_schema='public'",
);
await depois.end();

console.log(`${BANCO} pronto: ${rows[0].n} tabelas`);
