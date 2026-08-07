/**
 * CLI entry point for the radar-mv transition, so the skill and the web app
 * share one implementation instead of restating the rules in two places.
 *
 * Usage: npx tsx web/scripts/radar-mv.mts <slug> approve|reject [--reason="..."] [--dry-run]
 */
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The skill invokes this from the repo root, so the radar root is derived from
// this file's own location instead of cwd. Imports are dynamic because the
// modules read RADAR_ROOT at load time.
process.env.RADAR_ROOT ??= path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const { loadManifest, resolvePaths } = await import("../lib/manifest");
const { runTransition, TransitionError } = await import("../lib/transitions/mv");
type Direction = "approve" | "reject";

function fail(message: string): never {
  console.error(`erro: ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const flags = args.filter((arg) => arg.startsWith("--"));
const positional = args.filter((arg) => !arg.startsWith("--"));

const [rawSlug, rawDirection] = positional;
if (!rawSlug || !rawDirection) {
  fail('uso: radar-mv.mts <slug> approve|reject [--reason="..."] [--dry-run]');
}
if (rawDirection !== "approve" && rawDirection !== "reject") {
  fail(`direção inválida: ${rawDirection} (esperado approve ou reject)`);
}

const direction = rawDirection as Direction;
const dryRun = flags.includes("--dry-run");
const reason = flags
  .find((flag) => flag.startsWith("--reason="))
  ?.slice("--reason=".length)
  .replace(/^["']|["']$/g, "");

const paths = resolvePaths(await loadManifest());

// The skill accepts a unique prefix, not only the full slug.
const pending = (await readdir(paths.briefsDir["pendente-aprovacao"]).catch(() => []))
  .filter((name) => name.endsWith(".md"))
  .map((name) => name.slice(0, -3));

let slug = rawSlug;
if (!pending.includes(rawSlug)) {
  const matches = pending.filter((name) => name.startsWith(rawSlug));
  if (matches.length === 0) {
    fail(`nenhum brief em pendente-aprovacao/ casa com \`${rawSlug}\``);
  }
  if (matches.length > 1) {
    console.error(`prefixo ambíguo — ${matches.length} candidatos:`);
    for (const match of matches) console.error(`  ${match}`);
    process.exit(1);
  }
  slug = matches[0];
}

try {
  const result = await runTransition(
    { slug, direction, reason, dryRun, actor: "skill:radar-mv" },
    paths,
  );

  const verb = direction === "approve" ? "approved" : "rejected";
  console.log(`${result.applied ? (direction === "approve" ? "✅" : "🗑 ") : "🔎"} ${verb}: ${slug}`);
  console.log(`   brief → ${result.to}/${result.applied ? "" : "  (dry-run: nada foi escrito)"}`);

  if (direction === "approve") {
    console.log(`   hero  → ${result.mediaKept ?? "nenhuma foto"}`);
  }
  if (result.mediaDeleted.length > 0) {
    console.log(`   mídia → ${result.mediaDeleted.length} arquivo(s) ${result.applied ? "apagado(s)" : "seriam apagados"}`);
  }
  for (const warning of result.warnings) console.log(`   ⚠  ${warning}`);
  if (result.applied) {
    console.log("   ledger: 1 evento novo");
    if (direction === "approve") {
      console.log("   próximo passo: rode /radar-handoff (spec 007) pra subir Cloudinary + gerar package");
    } else {
      console.log("   anti-repetição: o .md fica em rejeitado/ e bloqueia re-propor (spec 003 §8.3)");
    }
  }
} catch (error) {
  if (error instanceof TransitionError) fail(error.message);
  throw error;
}
