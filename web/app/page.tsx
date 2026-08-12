import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { BRIEF_STATES, loadManifest, resolvePaths, type BriefState } from "@/lib/manifest";
import { listAllStates, type Brief } from "@/lib/store/briefs";
import { readLedger } from "@/lib/store/ledger";

// The store is read from disk on every request, so nothing may be prerendered.
export const dynamic = "force-dynamic";

const STATE_LABELS: Record<BriefState, string> = {
  "pendente-aprovacao": "Aprovação",
  "pendente-publicacao": "Publicação",
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
  const readyToPublish = byState.get("pendente-publicacao")?.briefs.length ?? 0;
  const recent = ledger.events.slice(-10).reverse();
  const failures = listings.flatMap((listing) => listing.failures);

  return (
    <main className="app-shell">
      <nav className="app-nav">
        <div className="app-container flex h-16 items-center justify-between gap-4">
          <Link href="/" className="text-base font-bold text-[var(--text-strong)]">
            <span className="inline-flex items-center gap-2"><span className="nav-icon" aria-hidden="true">◐</span><span>content-radar</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/fila" className="button-primary px-3 py-2 text-base"><span className="nav-icon" aria-hidden="true">☰</span><span>Fila {queue.length > 0 ? `(${queue.length})` : ""}</span></Link>
            <Link href="/briefs" className="button-secondary px-3 py-2 text-base"><span className="nav-icon" aria-hidden="true">▦</span><span>Acervo</span></Link>
            <Link href="/chat" className="button-secondary px-3 py-2 text-base"><span className="nav-icon" aria-hidden="true">◇</span><span>Chat</span></Link>
            <Link href="/config" className="button-secondary px-3 py-2 text-base"><span className="nav-icon" aria-hidden="true">⚙</span><span>Configuração</span></Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="app-container page-section">
        <header className="mb-8 grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-end">
          <div>
            <p className="eyebrow mb-3">Operação editorial</p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-[var(--text-strong)] sm:text-5xl">
              Radar de briefs, aprovações e publicação.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-6 muted">
              Meta de {manifest.funnel.candidates_per_week_target} candidatos por semana, score mínimo {" "}
              {manifest.anti_repetition.match_score_min} e faixa borderline a partir de {" "}
              {manifest.anti_repetition.borderline_min}.
            </p>
          </div>
          <div className="surface p-4">
            <p className="eyebrow">Prioridade agora</p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div>
                <div className="text-4xl font-semibold tabular-nums text-[var(--text-accent)]">
                  {queue.length}
                </div>
                <p className="mt-1 text-base muted">briefs aguardando decisão</p>
              </div>
              <Link href="/fila" className="button-primary px-4 py-2 text-base">
                Revisar
              </Link>
            </div>
          </div>
        </header>

        {failures.length > 0 && (
          <section className="alert-danger mb-6 p-4 text-base">
            <h2 className="font-semibold">Briefs ilegíveis ({failures.length})</h2>
            <ul className="mt-2 space-y-1">
              {failures.map((failure) => (
                <li key={failure.filePath} className="font-mono text-sm">
                  {failure.filePath}: {failure.message}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="panel mb-8 grid grid-cols-2 divide-x divide-y divide-[color:var(--line)] overflow-hidden sm:grid-cols-4 sm:divide-y-0">
          {BRIEF_STATES.map((state) => (
            <div key={state} className="p-5">
              <div className="text-3xl font-semibold tabular-nums text-[var(--text-accent)]">
                {byState.get(state)?.briefs.length ?? 0}
              </div>
              <div className="mt-2 text-sm font-semibold uppercase muted">
                {STATE_LABELS[state]}
              </div>
            </div>
          ))}
        </section>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-[color:var(--line)] px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-strong)]">Fila de aprovação</h2>
                <p className="mt-1 text-sm muted">Decisões pendentes antes da publicação.</p>
              </div>
              <Link href="/fila" className="text-link text-base">
                Abrir fila
              </Link>
            </div>

            <ul>
              {queue.slice(0, 6).map((brief) => (
                <li key={brief.slug} className="row row-hover px-5 py-4">
                  <div className="flex gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm muted">
                        <span className="font-mono">{brief.briefId}</span>
                        {brief.pillar && <span>{brief.pillar}</span>}
                        {brief.icp && <span>{brief.icp}</span>}
                        {brief.borderline && <span className="pill pill-warning px-2 py-1">borderline</span>}
                      </div>
                      <p className="mt-2 truncate font-semibold text-[var(--text-strong)]">
                        {brief.headline ?? brief.slug}
                      </p>
                      <p className="mt-2 text-sm leading-5 muted">
                        {brief.matchScore !== undefined ? `score ${brief.matchScore}` : "sem score"}
                        {" · "}
                        {heroLabel(brief)}
                        {" · "}
                        {brief.candidates.filter((candidate) => candidate.exists).length} mídia(s) em cache
                      </p>
                      {brief.warnings.length > 0 && (
                        <p className="mt-2 text-sm font-semibold text-[#7b4b12]">
                          {brief.warnings.join(" · ")}
                        </p>
                      )}
                    </div>
                    <div className="hidden shrink-0 -space-x-2 sm:flex">
                      {brief.candidates
                        .filter((candidate) => candidate.exists && candidate.fileName)
                        .slice(0, 3)
                        .map((candidate) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={candidate.index}
                            src={`/api/media/${brief.state}/${encodeURIComponent(candidate.fileName!)}`}
                            alt={candidate.alt ?? `candidata ${candidate.index}`}
                            className="h-12 w-12 rounded-lg border-2 border-[color:var(--surface)] object-cover"
                          />
                        ))}
                    </div>
                  </div>
                </li>
              ))}
              {queue.length === 0 && (
                <li className="px-5 py-8 text-base muted">Nada pendente de aprovação.</li>
              )}
            </ul>
          </section>

          <aside className="space-y-6">
            <section className="panel p-5">
              <p className="eyebrow">Saúde do fluxo</p>
              <dl className="mt-4 space-y-4 text-base">
                <div className="flex justify-between gap-4">
                  <dt className="muted">Pronto para publicar</dt>
                  <dd className="font-semibold tabular-nums text-[var(--text-accent)]">{readyToPublish}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="muted">Eventos registrados</dt>
                  <dd className="font-semibold tabular-nums text-[var(--text-accent)]">{ledger.events.length}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="muted">Arquivos com falha</dt>
                  <dd className="font-semibold tabular-nums text-[var(--text-accent)]">{failures.length}</dd>
                </div>
              </dl>
            </section>

            <section className="panel overflow-hidden">
              <div className="border-b border-[color:var(--line)] px-5 py-4">
                <h2 className="text-lg font-semibold text-[var(--text-strong)]">Últimos eventos</h2>
              </div>
              <ul className="font-mono text-sm">
                {recent.map((event, index) => (
                  <li key={`${event.ts}-${index}`} className="row px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[#748CAB]">{event.ts.slice(5, 16)}</span>
                      <span className="font-semibold text-[var(--text-accent)]">{event.event}</span>
                    </div>
                    <div className="mt-1 truncate muted">
                      {event.brief_id ?? event.scan_id ?? ""} {event.actor ? `· ${event.actor}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
