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
 * Refaz os REVOKE que o GRANT acima acabou de desfazer.
 *
 * A ordem é traiçoeira: as migrações revogam, e o `GRANT ... ON ALL TABLES`
 * logo depois devolve tudo. Sem esta lista o banco de teste fica **mais
 * permissivo** que produção justamente nas tabelas que existem para não ser
 * reescritas — e o sintoma é um teste de proteção passando por engano.
 *
 * Aconteceu: a tabela `consumo` nasceu append-only na migração e chegou aqui
 * com UPDATE e DELETE de volta.
 */
const APPEND_ONLY = ["evento", "consumo"];
for (const tabela of APPEND_ONLY) {
  await depois.query(
    `REVOKE UPDATE, DELETE ON TABLE "${tabela}" FROM ${papelApp}`,
  );
}

const { rows } = await depois.query(
  "select count(*)::int as n from information_schema.tables where table_schema='public'",
);
await depois.end();

/**
 * Semeia a Avanz também aqui.
 *
 * Três arquivos de teste leem a configuração de um cliente real em vez de criar
 * a sua — é o acoplamento com o dado de verdade que lhes dá valor, porque é ele
 * que pega contrato de skill quebrado e vault mal lido. Num banco recém-criado
 * eles não teriam o que ler, e a separação de bancos teria custado 24 testes.
 *
 * Isso não copia nada do banco de trabalho: o vault mora num documento do
 * repositório, e é dele que as duas semeaduras saem. O banco de teste continua
 * descartável e reconstruível sem depender de nenhum outro.
 */
const { provisionar } = await import("../db/provisionar");
const { semearVault } = await import("../db/seed/semear-vault");

/**
 * Rodar de novo tem de funcionar. Sem isto o segundo preparo morre em chave
 * duplicada, e quem o rodasse concluiria que o banco de teste está corrompido
 * quando o defeito é do script.
 */
const limpeza = new Pool({ connectionString: donoTeste });
await limpeza.query("delete from ambiente where slug = $1", ["avanz-imoveis"]);
await limpeza.end();

const ambiente = await provisionar(
  {
    slug: "avanz-imoveis",
    nome: "Avanz Imóveis",
    email: "suite@teste.local",
    senha: "suite-de-teste-local",
  },
  donoTeste,
);
const semeado = await semearVault(ambiente.ambienteId, donoTeste);

/**
 * O vault traz a prosa; escopos, fontes, marca, templates e o histórico de
 * briefs vêm do `store/` e do `manifest.yaml`. São as duas metades da mesma
 * semeadura — sem a segunda, os testes de workspace veem um ambiente que
 * existe e está vazio, que é pior de diagnosticar que um ausente.
 */
const { importar } = await import("../db/seed/importar");
const importado = await importar(ambiente.ambienteId, donoTeste);

console.log(
  `${BANCO} pronto: ${rows[0].n} tabelas, avanz-imoveis semeada ` +
    `(${semeado.pilares} pilares, ${semeado.publicos} públicos, ${semeado.temas} temas, ` +
    `${importado.briefs} briefs)`,
);
