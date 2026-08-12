import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { RouteHistory } from "@/components/route-history";
import { notFound } from "next/navigation";
import { BriefDetailContent } from "@/components/brief-detail-content";
import { toQueueBrief } from "@/components/brief-mapper";
import { loadManifest, resolvePaths } from "@/lib/manifest";
import { listState } from "@/lib/store/briefs";

export const dynamic = "force-dynamic";

export default async function BriefReviewDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const paths = resolvePaths(await loadManifest());
  const { briefs, failures } = await listState("pendente-aprovacao", paths);
  const brief = briefs.find((entry) => entry.slug === slug);

  if (!brief) notFound();

  const queueBrief = toQueueBrief(brief);
  const storedLabel =
    queueBrief.storedHeroChoice === undefined
      ? "campo ausente"
      : queueBrief.storedHeroChoice === null
        ? "sem foto escolhida"
        : `foto ${queueBrief.storedHeroChoice}`;

  return (
    <main className="app-shell">
      <nav className="app-nav">
        <div className="app-container flex h-16 items-center justify-between gap-4">
          <Link href="/" className="text-base font-bold text-[var(--text-strong)]">
            <span className="inline-flex items-center gap-2"><span className="nav-icon" aria-hidden="true">◐</span><span>content-radar</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/fila" className="button-secondary px-3 py-2 text-base"><span className="nav-icon" aria-hidden="true">☰</span><span>Fila</span></Link>
            <Link href="/briefs" className="button-secondary px-3 py-2 text-base"><span className="nav-icon" aria-hidden="true">▦</span><span>Acervo</span></Link>
            <Link href="/chat" className="button-secondary px-3 py-2 text-base"><span className="nav-icon" aria-hidden="true">◇</span><span>Chat</span></Link>
            <Link href="/config" className="button-secondary px-3 py-2 text-base"><span className="nav-icon" aria-hidden="true">⚙</span><span>Configuração</span></Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="app-container page-section">
        <header className="mb-8">
          <RouteHistory items={[{ label: "Dashboard", href: "/", icon: "◐" }, { label: "Fila", href: "/fila", icon: "☰" }, { label: queueBrief.briefId }]} />
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-alpha)] px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 text-sm muted">
              <span className="font-mono">{queueBrief.briefId}</span>
              {queueBrief.pillar && <span>{queueBrief.pillar}</span>}
              {queueBrief.icp && <span>{queueBrief.icp}</span>}
              {queueBrief.scope && <span>escopo {queueBrief.scope}</span>}
              {queueBrief.borderline && <span className="pill pill-warning px-2 py-1">borderline</span>}
            </div>
            <Link href={`/fila/${queueBrief.slug}/editar`} className="button-primary px-4 py-2 text-base"><span className="nav-icon" aria-hidden="true">✎</span><span>Editar brief</span></Link>
          </div>
          <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
            <div>
              <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight text-[var(--text-strong)]">
                {queueBrief.headline ?? queueBrief.slug}
              </h1>
              {queueBrief.hook && (
                <p className="mt-4 max-w-3xl text-base leading-6 muted">{queueBrief.hook}</p>
              )}
            </div>

            <aside className="surface p-4">
              <p className="eyebrow">Resumo da revisão</p>
              <dl className="mt-4 space-y-3 text-base">
                <div className="flex justify-between gap-4">
                  <dt className="muted">Score</dt>
                  <dd className="font-semibold tabular-nums text-[var(--text-accent)]">
                    {queueBrief.matchScore ?? "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="muted">Arte gravada</dt>
                  <dd className="font-semibold text-[var(--text-accent)]">{storedLabel}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="muted">Candidatas</dt>
                  <dd className="font-semibold tabular-nums text-[var(--text-accent)]">
                    {queueBrief.candidates.length}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="muted">Em cache</dt>
                  <dd className="font-semibold tabular-nums text-[var(--text-accent)]">
                    {queueBrief.candidates.filter((candidate) => candidate.exists).length}
                  </dd>
                </div>
              </dl>
            </aside>
          </div>
        </header>

        {failures.length > 0 && (
          <p className="alert-danger mb-6 p-3 text-base">
            {failures.length} brief(s) ilegíveis também foram encontrados nesta pasta.
          </p>
        )}

        <section className="panel p-5 sm:p-6">
          <BriefDetailContent brief={queueBrief} />
        </section>
      </div>
    </main>
  );
}
