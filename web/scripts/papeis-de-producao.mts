/**
 * Cria os segredos de produção e o SQL que provisiona os papéis do Postgres.
 *
 *   npx tsx scripts/papeis-de-producao.mts
 *   sudo -u postgres psql -f ../.local/papeis-producao.sql
 *   npx tsx --env-file=.env.producao scripts/papeis-de-producao.mts --conferir
 *
 * ## Por que papéis próprios
 *
 * Produção deixa de ser alcançável com a credencial que está no `.env.local` de
 * uma máquina de trabalho. Não é zelo abstrato: esse arquivo circula, entra em
 * backup de home, aparece em `ps` de quem roda script com `--env-file`.
 *
 * ## Por que um grupo no meio
 *
 * As migrações revogavam UPDATE e DELETE de `evento` e `consumo` citando
 * `radar_app` pelo nome. Um papel de aplicação novo nasceria com esses
 * privilégios intactos — e append-only é o tipo de garantia cuja quebra não
 * aparece: nada falha, o ledger só deixa de valer como registro. Os privilégios
 * agora moram em `radar_apps`, e papel novo de aplicação é mais um membro.
 *
 * ## Por que o SQL vai para arquivo em vez do terminal
 *
 * Ele carrega as senhas geradas. Impresso, ficaria no scrollback e no histórico
 * de quem copiar e colar. O arquivo nasce 600 e é para apagar depois de rodar.
 */

import { randomBytes } from "node:crypto";
import { writeFile, chmod, readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

const BANCO = "radar_prod";
const GRUPO = "radar_apps";
const APP = "radar_app_prod";
const DONO = "radar_owner_prod";
/** Os papéis de desenvolvimento, que perdem acesso ao banco de produção. */
const APP_DEV = "radar_app";
const DONO_DEV = "radar_owner";

const RAIZ = path.resolve(import.meta.dirname, "..", "..");
const SQL = path.join(RAIZ, ".local", "papeis-producao.sql");
const ENV = path.join(RAIZ, "web", ".env.producao");

/** base64url: cabe numa URL de conexão sem escapar nada. */
const segredo = (bytes: number) => randomBytes(bytes).toString("base64url");

if (!process.argv.includes("--conferir")) {
  const senhaApp = segredo(24);
  const senhaDono = segredo(24);

  await writeFile(
    SQL,
    `-- Gerado por scripts/papeis-de-producao.mts. Contém senhas.
-- Rode como superusuário e **apague depois**:
--
--   sudo -u postgres psql -f ${SQL}
--   shred -u ${SQL}

-- Papéis são do cluster, não do banco: criar só se ainda não existirem.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${GRUPO}') THEN
    CREATE ROLE ${GRUPO} NOLOGIN;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP}') THEN
    CREATE ROLE ${APP} LOGIN PASSWORD '${senhaApp}';
  ELSE
    ALTER ROLE ${APP} PASSWORD '${senhaApp}';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DONO}') THEN
    CREATE ROLE ${DONO} LOGIN PASSWORD '${senhaDono}';
  ELSE
    ALTER ROLE ${DONO} PASSWORD '${senhaDono}';
  END IF;
END $$;

-- Os dois papéis de aplicação herdam o que o grupo pode — e o que ele não pode.
GRANT ${GRUPO} TO ${APP_DEV};
GRANT ${GRUPO} TO ${APP};

-- Quem entra em ${BANCO}. O REVOKE de PUBLIC é o que fecha a porta: sem ele
-- qualquer papel do cluster conecta, e a separação seria só de nome.
REVOKE CONNECT ON DATABASE ${BANCO} FROM PUBLIC;
GRANT CONNECT ON DATABASE ${BANCO} TO ${APP};
GRANT CONNECT ON DATABASE ${BANCO} TO ${DONO};
ALTER DATABASE ${BANCO} OWNER TO ${DONO};

\\connect ${BANCO}

-- Posse das tabelas, sequências e views. Um a um, e não com REASSIGN OWNED:
-- REASSIGN pega também objetos compartilhados do cluster, e ${DONO_DEV} é dono
-- do radar_dev — a versão preguiçosa levaria o banco de desenvolvimento junto.
DO $$
DECLARE alvo record;
BEGIN
  FOR alvo IN
    SELECT c.oid::regclass AS obj
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'drizzle')
      AND c.relkind IN ('r', 'S', 'v', 'm', 'p')
      AND pg_get_userbyid(c.relowner) = '${DONO_DEV}'
  LOOP
    EXECUTE format('ALTER TABLE %s OWNER TO ${DONO}', alvo.obj);
  END LOOP;
END $$;

ALTER SCHEMA public OWNER TO ${DONO};
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'drizzle') THEN
    EXECUTE 'ALTER SCHEMA drizzle OWNER TO ${DONO}';
  END IF;
END $$;

-- Tabelas que ainda não existem. Sem isto, a próxima migração cria tabela que
-- a aplicação não enxerga — e o erro aparece como "permission denied" numa tela
-- qualquer, longe daqui.
ALTER DEFAULT PRIVILEGES FOR ROLE ${DONO} IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${GRUPO};
ALTER DEFAULT PRIVILEGES FOR ROLE ${DONO} IN SCHEMA public
  GRANT SELECT, USAGE ON SEQUENCES TO ${GRUPO};

-- E o default antigo, que apontava para ${APP_DEV}, sai de cena.
ALTER DEFAULT PRIVILEGES FOR ROLE ${DONO_DEV} IN SCHEMA public
  REVOKE ALL ON TABLES FROM ${APP_DEV};
ALTER DEFAULT PRIVILEGES FOR ROLE ${DONO_DEV} IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM ${APP_DEV};
`,
    { mode: 0o600 },
  );
  await chmod(SQL, 0o600);

  const jaTem = await readFile(ENV, "utf8").catch(() => null);
  if (jaTem && !process.argv.includes("--forcar")) {
    console.error(
      `\n${ENV} já existe.\n` +
        `Sobrescrever geraria senhas que não batem com os papéis já criados.\n` +
        `Se é isso mesmo que você quer, repita com --forcar.\n`,
    );
    process.exit(1);
  }

  await writeFile(
    ENV,
    `# Segredos de produção. Gerado por scripts/papeis-de-producao.mts.
#
# Não versionado (.gitignore cobre .env*), modo 600. As senhas daqui só existem
# neste arquivo e no Postgres — não há de onde recuperá-las. Se sumir, o
# caminho é rodar o script de novo com --forcar, que troca as duas senhas.

DATABASE_URL=postgres://${APP}:${senhaApp}@127.0.0.1:5432/${BANCO}
DATABASE_URL_MIGRATIONS=postgres://${DONO}:${senhaDono}@127.0.0.1:5432/${BANCO}

# Novo, e não o de desenvolvimento: com o mesmo segredo, quem tem o .env.local
# forja sessão de qualquer cliente em produção.
SESSION_SECRET=${segredo(48)}

# Fechado. Enquanto não houver decisão sobre quem pode criar conta, cada
# servidor novo nasceria como torneira de ambientes.
CADASTRO_ABERTO=0

RADAR_ROOT=${RAIZ}
NODE_ENV=production

# Mesma conta do Cloudinary; as chaves continuam saindo de .local/cloudinary.env,
# que é da conta. O que muda é o prefixo do public_id — produção fica com a pasta
# canônica do manifest, e desenvolvimento com a sua, em .env.local.
#
# Sem isso os dois escrevem no mesmo objeto: os bancos saíram da mesma cópia e
# têm os mesmos slugs, e o envio usa overwrite. Subir um brief em dev trocaria a
# imagem publicada do mesmo brief aqui.
CLOUDINARY_FOLDER=content-radar/avanz
`,
    { mode: 0o600 },
  );
  await chmod(ENV, 0o600);

  console.log(
    `\nEscritos, os dois em 600:\n` +
      `  ${SQL}   (senhas — apague depois de rodar)\n` +
      `  ${ENV}\n\n` +
      `1. Provisione os papéis:\n\n` +
      `     sudo -u postgres psql -v ON_ERROR_STOP=1 -f ${SQL}\n\n` +
      `2. Migre — dev primeiro, que é onde um erro é barato, depois o teste:\n\n` +
      `     node --env-file=.env.local    node_modules/.bin/tsx scripts/migrar.mts\n` +
      `     node --env-file=.env.producao node_modules/.bin/tsx scripts/migrar.mts\n` +
      `     npx tsx scripts/preparar-banco-de-teste.mts\n\n` +
      `3. Confira:\n\n` +
      `     npx tsx --env-file=.env.producao scripts/papeis-de-producao.mts --conferir\n\n` +
      `4. Apague o SQL:  shred -u ${SQL}\n`,
  );
  process.exit(0);
}

/* ── conferência ────────────────────────────────────────────────────────── */

const urlApp = process.env.DATABASE_URL;
const urlDono = process.env.DATABASE_URL_MIGRATIONS;
if (!urlApp || !urlDono) {
  console.error("rode com --env-file=.env.producao");
  process.exit(1);
}

let falhou = false;
const conta = (ok: boolean, texto: string) => {
  if (!ok) falhou = true;
  console.log(`  ${ok ? "ok " : "DIF"} ${texto}`);
};

const app = new Pool({ connectionString: urlApp });
const dono = new Pool({ connectionString: urlDono });

console.log(`\n${BANCO}:`);

conta(new URL(urlApp).username === APP, `a aplicação conecta como ${APP}`);
conta(new URL(urlDono).username === DONO, `as migrações rodam como ${DONO}`);

const { rows: membro } = await app.query<{ n: number }>(
  `select count(*)::int as n from pg_auth_members m
    join pg_roles g on g.oid = m.roleid join pg_roles r on r.oid = m.member
   where g.rolname = $1 and r.rolname = $2`,
  [GRUPO, APP],
);
conta(membro[0].n === 1, `${APP} é membro de ${GRUPO}`);

/**
 * O ponto todo desta mudança. Se falhar aqui, o append-only não vale para o
 * papel de produção — e nada mais no sistema vai reclamar disso.
 */
for (const tabela of ["evento", "consumo"]) {
  const { rows } = await app.query<{ pode: boolean }>(
    `select has_table_privilege($1, $2, 'UPDATE') or
            has_table_privilege($1, $2, 'DELETE') as pode`,
    [APP, tabela],
  );
  conta(!rows[0].pode, `${APP} não pode alterar nem apagar ${tabela}`);
  const { rows: leitura } = await app.query<{ pode: boolean }>(
    `select has_table_privilege($1, $2, 'INSERT') as pode`,
    [APP, tabela],
  );
  conta(leitura[0].pode, `${APP} ainda grava em ${tabela}`);
}

/** Os papéis de desenvolvimento não alcançam este banco. */
for (const papel of [APP_DEV, DONO_DEV]) {
  const { rows } = await app.query<{ pode: boolean }>(
    `select has_database_privilege($1, $2, 'CONNECT') as pode`,
    [papel, BANCO],
  );
  conta(!rows[0].pode, `${papel} não conecta em ${BANCO}`);
}

const { rows: alheias } = await dono.query<{ n: number; quem: string | null }>(
  `select count(*)::int as n, min(pg_get_userbyid(c.relowner)) as quem
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public','drizzle') and c.relkind in ('r','S','v','m','p')
     and pg_get_userbyid(c.relowner) <> $1`,
  [DONO],
);
conta(
  alheias[0].n === 0,
  alheias[0].n === 0
    ? `toda a posse é de ${DONO}`
    : `${alheias[0].n} objeto(s) ainda de ${alheias[0].quem}`,
);

/** A verificação que já enganou uma vez: contar sem satisfazer a política. */
const cliente = await app.connect();
try {
  const { rows: cego } = await cliente.query<{ n: number }>(
    "select count(*)::int as n from brief",
  );
  conta(cego[0].n === 0, `sem app.ambiente, ${APP} não vê brief nenhum`);

  await cliente.query("begin");
  const { rows: amb } = await cliente.query<{ id: string }>(
    "select id from ambiente limit 1",
  );
  if (amb[0]) {
    await cliente.query("select set_config('app.ambiente', $1, true)", [
      amb[0].id,
    ]);
    const { rows: vendo } = await cliente.query<{ n: number }>(
      "select count(*)::int as n from brief",
    );
    conta(vendo[0].n > 0, `com app.ambiente, vê ${vendo[0].n} brief(s)`);
  }
  await cliente.query("commit");
} finally {
  cliente.release();
}

await app.end();
await dono.end();

if (falhou) {
  console.error(`\nNão aponte nada para ${BANCO} ainda.\n`);
  process.exit(1);
}
console.log(
  `\nConfere. Apague ${SQL} se ainda não apagou, e sobra apontar a app e o\n` +
    `trabalhador para .env.producao.\n`,
);
