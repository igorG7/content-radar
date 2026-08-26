/**
 * Cria um ambiente. Operação rara, feita pelo operador do produto — uma vez por
 * cliente —, por isso linha de comando e não painel administrativo.
 *
 * Uso:
 *   npx tsx scripts/provisionar.mts --slug=avanz-imoveis --nome="Avanz Imóveis" \
 *     --email=ivan@exemplo.com [--senha=...]
 *
 * Sem `--senha`, uma é gerada e impressa uma única vez.
 */

import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.RADAR_ROOT ??= path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.loadEnvFile(path.join(raiz, ".env.local"));

const { provisionar } = await import("../db/provisionar");

function arg(nome: string): string | undefined {
  return process.argv
    .slice(2)
    .find((a) => a.startsWith(`--${nome}=`))
    ?.split("=")
    .slice(1)
    .join("=");
}

function fail(mensagem: string): never {
  console.error(`erro: ${mensagem}`);
  process.exit(1);
}

const slug = arg("slug") ?? fail("--slug é obrigatório");
const nome = arg("nome") ?? slug;
const email = arg("email") ?? fail("--email é obrigatório");

if (!/^[a-z0-9-]+$/.test(slug))
  fail("slug aceita só minúsculas, números e hífen");
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("e-mail inválido");

// Gerada quando não vem por argumento: senha em linha de comando fica no
// histórico do shell.
const gerada = !arg("senha");
const senha = arg("senha") ?? randomBytes(18).toString("base64url");

try {
  const r = await provisionar({ slug, nome, email, senha });

  console.log(`✅ ambiente provisionado`);
  console.log(`   ambiente : ${r.slug}  ${r.ambienteId}`);
  console.log(`   usuário  : ${r.email}`);
  if (gerada)
    console.log(`   senha    : ${senha}   ← anote, não será mostrada de novo`);
  console.log(`   vault    : ${r.blocosVazios} blocos, todos vazios`);
  console.log();
  console.log(
    `   O vault nasce vazio de propósito: quem o preenche é o cliente,`,
  );
  console.log(`   pela entrevista dos primeiros passos.`);
} catch (erro) {
  const causa = (erro as { cause?: unknown }).cause ?? erro;
  const mensagem = String((causa as Error).message ?? causa);
  if (/duplicate key.*ambiente_slug/.test(mensagem))
    fail(`já existe ambiente com slug "${slug}"`);
  if (/duplicate key.*usuario_email/.test(mensagem))
    fail(`já existe usuário com e-mail "${email}"`);
  fail(mensagem);
}
