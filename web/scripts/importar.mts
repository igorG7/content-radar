/**
 * Importa o store de arquivos para um ambiente do banco.
 *
 * Uso:
 *   npx tsx scripts/importar.mts --ambiente=<slug> [--vault]
 *
 * `--vault` semeia os blocos a partir de docs/vault-avanz.md antes dos briefs.
 * Sem ele, o vault precisa já existir — os briefs referenciam pilar e público
 * por chave estrangeira, então não há como importar num ambiente vazio.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

process.env.RADAR_ROOT ??= path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.loadEnvFile(path.join(raiz, ".env.local"));

const { importar } = await import("../db/seed/importar");
const { semearVault } = await import("../db/seed/semear-vault");

const args = process.argv.slice(2);
const slug = args.find((a) => a.startsWith("--ambiente="))?.split("=")[1];
const comVault = args.includes("--vault");

if (!slug) {
  console.error("erro: --ambiente=<slug> é obrigatório");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_MIGRATIONS,
});
const { rows } = await pool.query(
  "select id, nome from ambiente where slug = $1",
  [slug],
);
await pool.end();

if (rows.length === 0) {
  console.error(
    `erro: não existe ambiente com slug "${slug}" — provisione antes`,
  );
  process.exit(1);
}
const ambienteId = rows[0].id as string;

console.log(`ambiente: ${rows[0].nome}  (${slug})\n`);

if (comVault) {
  const v = await semearVault(ambienteId);
  console.log("vault semeado");
  console.log(
    `  ${v.blocos} blocos · ${v.pilares} pilares · ${v.publicos} públicos · ` +
      `${v.guardrails} guardrails · ${v.temas} temas em ${v.temasDoPilar}\n`,
  );
}

try {
  const r = await importar(ambienteId);

  console.log("importado");
  console.log(
    `  ${r.briefs} briefs · ${r.candidatas} candidatas · ${r.scans} scans · ${r.eventos} eventos`,
  );
  console.log(`  ${r.semFoto} sem foto escolhida (a arte vem do Smart Design)`);
  console.log();
  console.log("  por estado — confira contra o store de arquivos:");
  for (const [estado, n] of Object.entries(r.porEstado).sort()) {
    console.log(`    ${estado.padEnd(20)} ${String(n).padStart(3)}`);
  }

  if (r.avisos.length > 0) {
    console.log(`\n⚠ ${r.avisos.length} aviso(s) — não impedem a carga:`);
    for (const a of r.avisos) console.log(`  ${a.onde}: ${a.detalhe}`);
  } else {
    console.log("\nsem divergências.");
  }
} catch (erro) {
  const relatorio = (
    erro as { relatorio?: { orfas: { onde: string; detalhe: string }[] } }
  ).relatorio;
  if (!relatorio) throw erro;

  console.error(
    `\n✗ importação interrompida — ${relatorio.orfas.length} referência(s) órfã(s):\n`,
  );
  for (const o of relatorio.orfas) console.error(`  ${o.onde}: ${o.detalhe}`);
  console.error(
    "\nNada foi gravado. Referência órfã é quebra, não ambiguidade:",
  );
  console.error(
    "o banco recusaria na chave estrangeira, só que no meio da carga.",
  );
  process.exit(1);
}
