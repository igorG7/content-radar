import { BRIEF_STATES, loadManifest, resolvePaths, type BriefState } from "@/lib/manifest";
import { listAllStates, type Brief } from "@/lib/store/briefs";
import { readLedger } from "@/lib/store/ledger";

// The store is read from disk on every request, so nothing may be prerendered.
export const dynamic = "force-dynamic";

const STATE_LABELS: Record<BriefState, string> = {
  "pendente-aprovacao": "Pendente de aprovação",
  "pendente-publicacao": "Pendente de publicação",
  publicado: "Publicado",
  rejeitado: "Rejeitado",
};

function heroLabel(brief: Brief): string {
  if (!brief.heroChoiceDeclared) return "hero_choice ausente";
  if (brief.heroChoice === null) return "sem foto escolhida";
  return `foto ${brief.heroChoice}`;
}

export default async function Dashboard() {
  const manifest = await loadManifest();
  const paths = resolvePaths(manifest);
  const [listings, ledger] = await Promise.all([
    listAllStates(paths),
    readLedger(paths.ledger),
  ]);

  const byState = new Map(listings.map((listing) => [listing.state, listing]));
  const queue = byState.get("pendente-aprovacao")?.briefs ?? [];
  const recent = ledger.events.slice(-12).reverse();
  const failures = listings.flatMap((listing) => listing.failures);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 font-sans">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">content-radar</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {manifest.funnel.candidates_per_week_target} candidatos/semana ·
          threshold {manifest.anti_repetition.match_score_min} · borderline a partir de{" "}
          {manifest.anti_repetition.borderline_min}
        </p>
      </header>

      {failures.length > 0 && (
        <section className="mb-8 rounded border border-red-300 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950">
          <h2 className="font-medium">Briefs ilegíveis ({failures.length})</h2>
          <ul className="mt-2 space-y-1">
            {failures.map((failure) => (
              <li key={failure.filePath} className="font-mono text-xs">
                {failure.filePath}: {failure.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {BRIEF_STATES.map((state) => (
          <div
            key={state}
            className="rounded border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="text-3xl font-semibold tabular-nums">
              {byState.get(state)?.briefs.length ?? 0}
            </div>
            <div className="mt-1 text-xs text-zinc-500">{STATE_LABELS[state]}</div>
          </div>
        ))}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Fila de aprovação
        </h2>
        <ul className="space-y-3">
          {queue.map((brief) => (
            <li
              key={brief.slug}
              className="rounded border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span className="font-mono">{brief.briefId}</span>
                    {brief.pillar && <span>· {brief.pillar}</span>}
                    {brief.icp && <span>· {brief.icp}</span>}
                    {brief.borderline && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                        borderline
                      </span>
                    )}
                  </div>
                  <p className="mt-1 font-medium">{brief.headline ?? brief.slug}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {brief.matchScore !== undefined ? `score ${brief.matchScore}` : "sem score"}
                    {" · "}
                    {heroLabel(brief)}
                    {" · "}
                    {brief.candidates.length} candidata(s),{" "}
                    {brief.candidates.filter((candidate) => candidate.exists).length} em cache
                  </p>
                  {brief.warnings.length > 0 && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-500">
                      {brief.warnings.join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  {brief.candidates
                    .filter((candidate) => candidate.exists && candidate.fileName)
                    .map((candidate) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={candidate.index}
                        src={`/api/media/${brief.state}/${encodeURIComponent(candidate.fileName!)}`}
                        alt={candidate.alt ?? `candidata ${candidate.index}`}
                        className="h-16 w-16 rounded object-cover"
                      />
                    ))}
                </div>
              </div>
            </li>
          ))}
          {queue.length === 0 && (
            <li className="text-sm text-zinc-500">Nada pendente de aprovação.</li>
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Ledger — últimos eventos ({ledger.events.length} no total)
        </h2>
        <ul className="space-y-1 font-mono text-xs">
          {recent.map((event, index) => (
            <li key={`${event.ts}-${index}`} className="flex gap-3">
              <span className="shrink-0 text-zinc-400">{event.ts.slice(0, 19)}</span>
              <span className="shrink-0">{event.event}</span>
              <span className="truncate text-zinc-500">
                {event.brief_id ?? event.scan_id ?? ""} {event.actor ? `· ${event.actor}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
