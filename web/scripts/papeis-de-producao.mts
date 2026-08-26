/**
 * Cria os segredos de produção e o SQL que provisiona os papéis do Postgres.
 *
 *   npx tsx scripts/papeis-de-producao.mts
 *   sudo -u postgres psql -v ON_ERROR_STOP=1 < ../.local/papeis-producao.sql
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
import { writeFile, chmod, readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

const BANCO = "radar_prod";
const GRUPO = "radar_apps";
const APP = "radar_app_prod";
const DONO = "radar_owner_prod";
/** Os papéis de desenvolvimento, que perdem acesso ao banco de produção. */
const APP_DEV = "radar_app";
const DONO_DEV = "radar_owner";

/** Como o resto do app: `RADAR_ROOT` manda, e o default é a raiz do clone. */
const RAIZ = process.env.RADAR_ROOT
  ? path.resolve(process.env.RADAR_ROOT)
  : path.resolve(import.meta.dirname, "..", "..");
/**
 * Dois arquivos, porque o restore acontece no meio.
 *
 * Os papéis precisam existir **antes** do dump: ele os cita pelo nome, em
 * `ALTER TABLE ... OWNER TO` e nos `GRANT`. A posse e os privilégios só podem
 * ser ajustados **depois**, quando as tabelas existem. Num arquivo só, uma das
 * duas metades roda na hora errada.
 */
const SQL_ANTES = path.join(RAIZ, ".local", "01-antes-do-restore.sql");
const SQL_DEPOIS = path.join(RAIZ, ".local", "02-depois-do-restore.sql");
const ENV = path.join(RAIZ, "web", ".env.producao");

/** base64url: cabe numa URL de conexão sem escapar nada. */
const segredo = (bytes: number) => randomBytes(bytes).toString("base64url");

if (!process.argv.includes("--conferir")) {
  const senhaApp = segredo(24);
  const senhaDono = segredo(24);

  // Antes de escrever qualquer coisa: recusar depois de gerar o SQL deixaria
  // arquivos com senhas que não batem com o .env vivo — e alguém as rodaria.
  const jaTem = await readFile(ENV, "utf8").catch(() => null);
  if (jaTem && !process.argv.includes("--forcar")) {
    console.error(
      `\n${ENV} já existe.\n` +
        `Sobrescrever geraria senhas que não batem com os papéis já criados.\n` +
        `Se é isso mesmo que você quer, repita com --forcar.\n`,
    );
    process.exit(1);
  }

  /**
   * `.local/` é gitignored, então não existe num clone novo — e era ali que o
   * script tentava escrever, morrendo em ENOENT antes de qualquer coisa útil.
   * Modo 700: o diretório guarda arquivos com senha.
   */
  await mkdir(path.dirname(SQL_ANTES), { recursive: true, mode: 0o700 });

  const cabecalho = (qual: string) =>
    `-- ${qual}. Gerado por scripts/papeis-de-producao.mts. **Contém senhas.**
--
-- Rode como superusuário, por stdin — o arquivo é 600 e do seu usuário, e o
-- psql roda como postgres. Quem lê é o seu shell:
--
--   sudo -u postgres psql -v ON_ERROR_STOP=1 < <este arquivo>
--
-- Apague os dois com \`shred -u\` quando terminar.
`;

  /**
   * Os papéis de desenvolvimento não existem numa instalação nova, e citá-los
   * cruamente aborta o arquivo em \`role does not exist\`. Guardados por
   * existência, o mesmo SQL serve nas duas máquinas — o que evita um segundo
   * roteiro que diverge do primeiro sem ninguém notar.
   */
  const seExistir = (papel: string, corpo: string) =>
    `DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${papel}') THEN
${corpo
  .split("\n")
  .map((l) => (l.trim() ? `    ${l}` : l))
  .join("\n")}
  END IF;
END $$;`;

  await writeFile(
    SQL_ANTES,
    `${cabecalho("Antes do restore")}
-- Só faz os nomes existirem: papéis e banco. Nada de posse ou privilégio —
-- não há tabela ainda.

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

-- O papel de aplicação herda do grupo o que pode — e o que não pode.
GRANT ${GRUPO} TO ${APP};
${seExistir(APP_DEV, `EXECUTE 'GRANT ${GRUPO} TO ${APP_DEV}';`)}

-- O banco. Sem \`IF NOT EXISTS\` no Postgres, então o psql monta o comando e
-- só executa se faltar — rodar duas vezes não é erro.
SELECT 'CREATE DATABASE ${BANCO} OWNER ${DONO}'
 WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '${BANCO}')\\gexec

-- Agora restaure o dump, e só depois rode o 02:
--
--   sudo -u postgres bash -c 'set -o pipefail; gzip -dc <dump>.sql.gz | psql -q -v ON_ERROR_STOP=1 ${BANCO}'
--
-- O \`pipefail\` não é zelo: sem ele, um gzip que falha passa despercebido
-- porque o status do pipeline é o do psql, que carrega o pedaço que chegou e
-- sai feliz. Foi assim que a primeira tentativa criou 22 tabelas vazias.
`,
    { mode: 0o600 },
  );
  await chmod(SQL_ANTES, 0o600);

  await writeFile(
    SQL_DEPOIS,
    `${cabecalho("Depois do restore")}
-- Posse e privilégios, agora que as tabelas existem.

ALTER DATABASE ${BANCO} OWNER TO ${DONO};

-- Quem entra em ${BANCO}. O REVOKE de PUBLIC é o que fecha a porta: sem ele
-- qualquer papel do cluster conecta, e a separação seria só de nome.
REVOKE CONNECT ON DATABASE ${BANCO} FROM PUBLIC;
GRANT CONNECT ON DATABASE ${BANCO} TO ${APP};
GRANT CONNECT ON DATABASE ${BANCO} TO ${DONO};

\\connect ${BANCO}

-- Posse de tudo que não for de ${DONO} — inclui o que o restore deixou do
-- superusuário e, numa migração a partir de dev, o que era de outro dono.
-- Um a um, e não com REASSIGN OWNED: REASSIGN pega também objetos
-- compartilhados do cluster e levaria outros bancos junto.
DO $$
DECLARE alvo record;
BEGIN
  FOR alvo IN
    SELECT c.oid::regclass AS obj
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'drizzle')
      AND c.relkind IN ('r', 'S', 'v', 'm', 'p')
      AND pg_get_userbyid(c.relowner) <> '${DONO}'
      -- Sequência de bigserial ou identity não é objeto independente: ela
      -- pertence à coluna, e o Postgres **recusa** trocar o dono dela em
      -- separado em vez de ignorar o pedido. Trocar o dono da tabela já leva a
      -- sequência junto, então basta não pedir.
      AND NOT (c.relkind = 'S' AND EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid
          AND d.refclassid = 'pg_class'::regclass AND d.deptype IN ('a', 'i')))
  LOOP
    EXECUTE format('ALTER TABLE %s OWNER TO ${DONO}', alvo.obj);
  END LOOP;
END $$;

-- Tipos também. O laço acima olha \`pg_class\`, que não os inclui: um enum
-- continua pertencendo a quem o criou, e o dump o carrega como
-- \`ALTER TYPE ... OWNER TO <papel de dev>\` — que aborta o restore numa
-- máquina onde esse papel não existe. Foi assim que a primeira tentativa na
-- VPS parou.
DO $$
DECLARE alvo record;
BEGIN
  FOR alvo IN
    SELECT t.oid::regtype AS obj
    FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname IN ('public', 'drizzle')
      AND t.typtype IN ('e', 'c', 'd')
      AND pg_get_userbyid(t.typowner) <> '${DONO}'
      -- O tipo-linha que toda tabela tem segue a tabela; pedir em separado é erro.
      AND NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.reltype = t.oid)
  LOOP
    EXECUTE format('ALTER TYPE %s OWNER TO ${DONO}', alvo.obj);
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

-- E o que sobrou do papel de aplicação de desenvolvimento: sem CONNECT ele já
-- não alcança o banco, mas privilégio que ninguém revogou é privilégio que
-- volta a valer no dia em que alguém devolver o CONNECT sem pensar.
${seExistir(APP_DEV, `EXECUTE 'REVOKE ALL ON SCHEMA public FROM ${APP_DEV}';`)}

-- E o default antigo de desenvolvimento, onde ele existir, sai de cena.
${seExistir(
  DONO_DEV,
  `EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE ${DONO_DEV} IN SCHEMA public REVOKE ALL ON TABLES FROM ${APP_DEV}';
EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE ${DONO_DEV} IN SCHEMA public REVOKE ALL ON SEQUENCES FROM ${APP_DEV}';`,
)}
`,
    { mode: 0o600 },
  );
  await chmod(SQL_DEPOIS, 0o600);

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

# Quem autentica as varreduras. Vazia aqui porque esta máquina tem sessão do
# Claude Code; **num servidor é obrigatória** — sem login interativo o SDK não
# encontra credencial, e a varredura termina vazia depois de vinte minutos em
# vez de falhar. O trabalhador confere na partida e recusa começar sem ela.
#
# Chave da conta da empresa, não pessoal: o custo dos scans dos clientes precisa
# cair onde a telemetria de consumo consegue prestar contas.
#
# Comentada, e não vazia: um ANTHROPIC_API_KEY= define a variável como string
# vazia, e chave vazia pode ofuscar a sessão do Claude Code em vez de cair nela.
# Descomente ao preencher.
# ANTHROPIC_API_KEY=

# Cloudinary. A conta é a mesma das duas instalações; o que as separa é o
# FOLDER, que prefixa o public_id — sem ele o identificador é
# <ambiente>/<brief>, igual nos dois bancos, e o envio usa overwrite.
#
# As três chaves nascem vazias: numa instalação nova elas precisam ser copiadas
# da conta. Faltando qualquer uma, o app segue inteiro e só não publica mídia.
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
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
    `\nEscritos, os três em 600:\n` +
      `  ${SQL_ANTES}   (senhas)\n` +
      `  ${SQL_DEPOIS}\n` +
      `  ${ENV}\n\n` +
      `A ordem importa: o dump cita os papéis pelo nome, então eles vêm antes;\n` +
      `a posse só pode ser ajustada depois que as tabelas existem.\n\n` +
      `Por stdin, e não com -f: os arquivos são 600 e seus, o psql roda como\n` +
      `postgres, e assim quem lê é o seu shell — o segredo não precisa ficar\n` +
      `legível para outra conta.\n\n` +
      `1. Papéis e banco:\n\n` +
      `     sudo -u postgres psql -v ON_ERROR_STOP=1 < ${SQL_ANTES}\n\n` +
      `2. Restaure o dump do backup:\n\n` +
      `     sudo -u postgres bash -c 'set -o pipefail; gzip -dc <dump>.sql.gz | psql -q -v ON_ERROR_STOP=1 ${BANCO}'\n\n` +
      `3. Posse e privilégios:\n\n` +
      `     sudo -u postgres psql -v ON_ERROR_STOP=1 < ${SQL_DEPOIS}\n\n` +
      `4. Confira — e não pule, porque é a única etapa que olha o resultado em\n` +
      `   vez do comando:\n\n` +
      `     npx tsx --env-file=.env.producao scripts/papeis-de-producao.mts --conferir\n\n` +
      `5. Apague os dois SQL:  shred -u ${SQL_ANTES} ${SQL_DEPOIS}\n\n` +
      `Falta preencher no ${ENV}: as três chaves do Cloudinary e a\n` +
      `ANTHROPIC_API_KEY, que nasce comentada.\n`,
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

/**
 * A posse, em **todas** as classes de objeto — não só tabelas.
 *
 * A primeira versão olhava só `pg_class` e disse "toda a posse é de
 * radar_owner_prod" com um enum ainda pertencendo ao papel de desenvolvimento.
 * O dump saiu com `ALTER TYPE ... OWNER TO radar_owner`, e o restore na VPS
 * abortou — numa máquina onde esse papel não existe. A conferência tinha o
 * mesmo ponto cego que o SQL que ela deveria conferir.
 */
const { rows: alheias } = await dono.query<{ tipo: string; nome: string; quem: string }>(
  `select 'relação' as tipo, c.relname as nome, pg_get_userbyid(c.relowner) as quem
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public','drizzle') and c.relkind in ('r','S','v','m','p')
      and pg_get_userbyid(c.relowner) <> $1
   union all
   select 'tipo', t.typname, pg_get_userbyid(t.typowner)
     from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname in ('public','drizzle') and t.typtype in ('e','c','d')
      and pg_get_userbyid(t.typowner) <> $1
      and not exists (select 1 from pg_class c where c.reltype = t.oid)
   union all
   select 'função', p.proname, pg_get_userbyid(p.proowner)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public','drizzle') and pg_get_userbyid(p.proowner) <> $1
   union all
   select 'schema', nspname, pg_get_userbyid(nspowner)
     from pg_namespace where nspname in ('public','drizzle')
      and pg_get_userbyid(nspowner) <> $1`,
  [DONO],
);
conta(
  alheias.length === 0,
  alheias.length === 0
    ? `toda a posse é de ${DONO}, em tabelas, tipos, funções e schemas`
    : `${alheias.length} objeto(s) de outro dono: ` +
      alheias
        .slice(0, 4)
        .map((a) => `${a.tipo} ${a.nome} → ${a.quem}`)
        .join("; "),
);

/**
 * Resíduo do papel de aplicação de desenvolvimento. Sem CONNECT ele não
 * alcança o banco, então isto não é brecha hoje — é a brecha de amanhã, se
 * alguém devolver o CONNECT achando que o resto já estava limpo.
 */
const { rows: residuo } = await dono.query<{ tem: boolean }>(
  `select has_schema_privilege($1,'public','USAGE') as tem`,
  [APP_DEV],
).catch(() => ({ rows: [{ tem: false }] }));
conta(!residuo[0].tem, `${APP_DEV} não tem privilégio no schema`);

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
  `\nConfere. Apague os SQL se ainda não apagou, e sobra apontar a app e o\n` +
    `trabalhador para .env.producao.\n`,
);
