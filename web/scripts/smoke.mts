/**
 * Reads the real store and asserts the invariants slice 1 depends on.
 * Run: npx tsx scripts/smoke.ts
 */
import { readFile } from "node:fs/promises";
import { loadManifest, resolvePaths, selectablePillars } from "../lib/manifest";
import { listAllStates } from "../lib/store/briefs";
import { readLedger } from "../lib/store/ledger";
import { parseFrontmatter, patchScalars } from "../lib/store/frontmatter";

let failures = 0;

function check(label: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "  ok " : "FAIL "} ${label}${detail ? ` — ${detail}` : ""}`);
}

const manifest = await loadManifest();
const paths = resolvePaths(manifest);

console.log("\n== manifest ==");
check("escopos de busca", Object.keys(manifest.search_scopes).length > 0,
  Object.keys(manifest.search_scopes).join(", "));
check("pilares selecionaveis excluem 4-bastidor",
  !selectablePillars(manifest).includes("4-bastidor"),
  selectablePillars(manifest).join(", "));
check("alvo por semana", manifest.funnel.candidates_per_week_target > 0,
  String(manifest.funnel.candidates_per_week_target));
check("threshold / borderline",
  manifest.anti_repetition.borderline_min < manifest.anti_repetition.match_score_min,
  `${manifest.anti_repetition.borderline_min} < ${manifest.anti_repetition.match_score_min}`);

console.log("\n== briefs ==");
const listings = await listAllStates(paths);
for (const listing of listings) {
  check(`${listing.state}`, listing.failures.length === 0,
    `${listing.briefs.length} briefs, ${listing.failures.length} ilegiveis`);
  for (const failure of listing.failures) console.log(`       ! ${failure.filePath}: ${failure.message}`);
}

const all = listings.flatMap((l) => l.briefs);
check("todo brief tem hero_choice declarado",
  all.every((b) => b.heroChoiceDeclared),
  `${all.filter((b) => !b.heroChoiceDeclared).length} sem o campo`);

const withWarnings = all.filter((b) => b.warnings.length > 0);
console.log(`  info  ${withWarnings.length} briefs com avisos`);
for (const brief of withWarnings.slice(0, 5)) {
  console.log(`       ~ ${brief.slug}: ${brief.warnings.join("; ")}`);
}

console.log("\n== fila de aprovacao ==");
const queue = listings.find((l) => l.state === "pendente-aprovacao")!.briefs;
for (const brief of queue) {
  const choice = !brief.heroChoiceDeclared ? "AUSENTE" : brief.heroChoice === null ? "null" : String(brief.heroChoice);
  const onDisk = brief.candidates.filter((c) => c.exists).length;
  console.log(
    `  ${brief.briefId}  score=${brief.matchScore ?? "?"}${brief.borderline ? " [borderline]" : ""}` +
    `  hero=${choice}  candidatas=${brief.candidates.length} (${onDisk} em disco)  ${brief.pillar}/${brief.icp}`,
  );
}

console.log("\n== edicao cirurgica do frontmatter ==");
const offenders: string[] = [];
let surgical = 0;
for (const brief of all) {
  const raw = await readFile(brief.filePath, "utf8");
  // Pick a value the brief cannot already hold, so "no change" means a real bug.
  const target = brief.heroChoice === 7 ? 8 : 7;
  const patched = patchScalars(raw, { hero_choice: target });

  const before = raw.split("\n");
  const after = patched.split("\n");
  const changed = before.flatMap((line, i) => (line === after[i] ? [] : [i]));
  const sameLineCount = before.length === after.length;
  const onlyHeroChoice = changed.length === 1 && after[changed[0]].startsWith("hero_choice:");
  const applied = parseFrontmatter(patched).data.hero_choice === target;

  if (sameLineCount && onlyHeroChoice && applied) surgical++;
  else offenders.push(`${brief.slug} (linhas alteradas: ${changed.length}, aplicado: ${applied})`);
}
check("patch de hero_choice altera exatamente 1 linha", offenders.length === 0,
  `${surgical}/${all.length}`);
for (const offender of offenders.slice(0, 5)) console.log(`       ~ ${offender}`);

console.log("\n== ledger ==");
const ledger = await readLedger(paths.ledger);
check("ledger legivel", ledger.malformedLines.length === 0,
  `${ledger.events.length} eventos, ${ledger.malformedLines.length} linhas invalidas`);
const byEvent = new Map<string, number>();
for (const event of ledger.events) byEvent.set(event.event, (byEvent.get(event.event) ?? 0) + 1);
for (const [name, count] of [...byEvent].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(4)}  ${name}`);
}

console.log(`\n${failures === 0 ? "SMOKE OK" : `SMOKE FALHOU (${failures})`}`);
process.exit(failures === 0 ? 0 : 1);
