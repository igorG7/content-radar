import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { RouteHistory } from "@/components/route-history";
import { toQueueBrief } from "@/components/brief-mapper";
import { loadManifest, resolvePaths, type BriefState } from "@/lib/manifest";
import { listAllStates } from "@/lib/store/briefs";

export const dynamic = "force-dynamic";

const ARCHIVE_STATES = ["pendente-publicacao", "publicado", "rejeitado"] as const satisfies BriefState[];

const STATE_LABELS: Record<(typeof ARCHIVE_STATES)[number], string> = {
  "pendente-publicacao": "Aprovados",
  publicado: "Publicados",
  rejeitado: "Rejeitados",
};

const STATE_DESCRIPTIONS: Record<(typeof ARCHIVE_STATES)[number], string> = {
  "pendente-publicacao": "Briefs aprovados e aguardando publicação.",
  publicado: "Briefs que já passaram para o estado publicado.",
  rejeitado: "Briefs rejeitados, preservados para histórico e anti-repetição.",
};

function normalizeState(value: string | undefined): (typeof ARCHIVE_STATES)[number] {
  return ARCHIVE_STATES.find((state) => state === value) ?? "pendente-publicacao";
}

function heroLabel(brief: ReturnType<typeof toQueueBrief>): string {
  if (brief.storedHeroChoice === undefined) return "hero_choice ausente";
  if (brief.storedHeroChoice === null) return "sem foto escolhida";
  return `foto ${brief.storedHeroChoice}`;
}

export default async function BriefArchive({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  const selectedState = normalizeState(estado);
  const paths = resolvePaths(await loadManifest());
  const listings = await listAllStates(paths);
  const byState = new Map(listings.map((listing) => [listing.state, listing]));
  const selected = byState.get(selectedState);
  const briefs = (selected?.briefs ?? []).map(toQueueBrief).reverse();
  const failures = selected?.failures ?? [];

  return (
    <main className="app-shell">
      <nav className="app-nav">
        <div className="app-container flex h-16 items-center justify-between gap-4">
          <Link href="/" className="text-base font-bold text-[var(--text-strong)]">
            <span className="inline-flex items-center gap-2"><span className="nav-icon" aria-hidden="true">◐</span><span>content-radar</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/fila" className="button-secondary px-3 py-2 text-base"><span className="nav-icon" aria-hidden="true">☰</span><span>Fila</span></Link>
            <Link href="/briefs" className="button-primary px-3 py-2 text-base"><span className="nav-icon" aria-hidden="true">▦</span><span>Acervo</span></Link>
            <Link href="/chat" className="button-secondary px-3 py-2 text-base"><span className="nav-icon" aria-hidden="true">◇</span><span>Chat</span></Link>
            <Link href="/config" className="button-secondary px-3 py-2 text-base"><span className="nav-icon" aria-hidden="true">⚙</span><span>Configuração</span></Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="app-container page-section">
        <header className="mb-8">
          <RouteHistory items={[{ label: "Dashboard", href: "/", icon: "◐" }, { label: "Acervo", icon: "▦" }]} />
          <p className="eyebrow mt-5 mb-2">Consulta editorial</p>
          <h1 className="text-4xl font-semibold text-[var(--text-strong)]">Acervo de briefs</h1>
          <p className="mt-3 max-w-2xl text-base leading-6 muted">
            Acesse briefs aprovados, publicados e rejeitados sem misturar com a fila ativa de revisão.
          </p>
        </header>

        <section className="panel mb-8 grid overflow-hidden sm:grid-cols-3">
          {ARCHIVE_STATES.map((state) => {
            const count = byState.get(state)?.briefs.length ?? 0;
            const active = state === selectedState;
            return (
              <Link
                key={state}
                href={`/briefs?estado=${state}`}
                className={`border-t border-[color:var(--line)] p-5 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0 ${
                  active ? "bg-[color:var(--surface-soft-alpha)]" : "row-hover"
                }`}
              >
                <div className="text-3xl font-semibold tabular-nums text-[var(--text-accent)]">{count}</div>
                <div className="mt-2 font-semibold text-[var(--text-strong)]">{STATE_LABELS[state]}</div>
                <p className="mt-1 text-sm muted">{STATE_DESCRIPTIONS[state]}</p>
              </Link>
            );
          })}
        </section>

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

        <section className="panel overflow-hidden">
          <div className="border-b border-[color:var(--line)] px-5 py-4">
            <h2 className="text-lg font-semibold text-[var(--text-strong)]">{STATE_LABELS[selectedState]}</h2>
            <p className="mt-1 text-sm muted">{briefs.length} brief(s) neste estado.</p>
          </div>
          <ul>
            {briefs.map((brief) => (
              <li key={brief.slug} className="row row-hover px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm muted">
                      <span className="font-mono">{brief.briefId}</span>
                      {brief.pillar && <span>{brief.pillar}</span>}
                      {brief.icp && <span>{brief.icp}</span>}
                      {brief.borderline && <span className="pill pill-warning px-2 py-1">borderline</span>}
                    </div>
                    <h3 className="mt-2 truncate text-xl font-semibold text-[var(--text-strong)]">
                      {brief.headline ?? brief.slug}
                    </h3>
                    {brief.hook && <p className="mt-2 line-clamp-2 max-w-3xl text-base leading-6 muted">{brief.hook}</p>}
                    <p className="mt-2 text-sm muted">
                      {brief.matchScore !== undefined ? `score ${brief.matchScore}` : "sem score"} · {heroLabel(brief)} · {brief.candidates.filter((candidate) => candidate.exists).length} mídia(s) em cache
                    </p>
                  </div>
                  <Link href={`/briefs/${selectedState}/${brief.slug}`} className="button-secondary px-3 py-2 text-base">
                    Abrir
                  </Link>
                </div>
              </li>
            ))}
            {briefs.length === 0 && <li className="px-5 py-8 text-base muted">Nenhum brief neste estado.</li>}
          </ul>
        </section>
      </div>
    </main>
  );
}
