import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { RouteHistory } from "@/components/route-history";
import { loadManifest, resolvePaths } from "@/lib/manifest";
import { listState } from "@/lib/store/briefs";
import { BriefCard } from "@/components/brief-card";
import { toQueueBrief } from "@/components/brief-mapper";

export const dynamic = "force-dynamic";

export default async function Queue() {
  const paths = resolvePaths(await loadManifest());
  const { briefs, failures } = await listState("pendente-aprovacao", paths);

  // Absolute server paths stay on the server.
  const queue = briefs.map(toQueueBrief);

  return (
    <main className="app-shell">
      <nav className="app-nav">
        <div className="app-container-narrow flex h-16 items-center justify-between gap-4">
          <Link href="/" className="text-base font-bold text-[var(--text-strong)]">
            <span className="inline-flex items-center gap-2"><span className="nav-icon" aria-hidden="true">◐</span><span>content-radar</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/briefs" className="button-secondary px-3 py-2 text-base"><span className="nav-icon" aria-hidden="true">▦</span><span>Acervo</span></Link>
            <Link href="/chat" className="button-secondary px-3 py-2 text-base"><span className="nav-icon" aria-hidden="true">◇</span><span>Chat</span></Link>
            <Link href="/config" className="button-secondary px-3 py-2 text-base"><span className="nav-icon" aria-hidden="true">⚙</span><span>Configuração</span></Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="app-container-narrow page-section">
        <header className="mb-8">
          <RouteHistory items={[{ label: "Dashboard", href: "/", icon: "◐" }, { label: "Fila", icon: "☰" }]} />
          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-2">Revisão humana</p>
              <h1 className="text-4xl font-semibold text-[var(--text-strong)]">Fila de aprovação</h1>
              <p className="mt-3 max-w-2xl text-base leading-6 muted">
                {queue.length} brief(s) aguardando. A escolha da arte é registrada nesta sessão;
                um hero_choice já gravado não conta como decisão sua.
              </p>
            </div>
            <div className="surface px-4 py-3 text-right">
              <div className="text-3xl font-semibold tabular-nums text-[var(--text-accent)]">{queue.length}</div>
              <div className="text-sm font-semibold uppercase muted">pendentes</div>
            </div>
          </div>
        </header>

        {failures.length > 0 && (
          <p className="alert-danger mb-6 p-3 text-base">
            {failures.length} brief(s) ilegíveis nesta pasta.
          </p>
        )}

        <ul className="space-y-4">
          {queue.map((brief) => (
            <BriefCard key={brief.slug} brief={brief} />
          ))}
          {queue.length === 0 && <li className="surface p-8 text-base muted">Nada pendente.</li>}
        </ul>
      </div>
    </main>
  );
}
