import Link from "next/link";
import { notFound } from "next/navigation";
import { BriefEditForm } from "@/components/brief-edit-form";
import { toQueueBrief } from "@/components/brief-mapper";
import { ThemeToggle } from "@/components/theme-toggle";
import { RouteHistory } from "@/components/route-history";
import { loadManifest, resolvePaths } from "@/lib/manifest";
import { listState } from "@/lib/store/briefs";

export const dynamic = "force-dynamic";

export default async function EditApprovedBrief({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const paths = resolvePaths(await loadManifest());
  const { briefs } = await listState("pendente-publicacao", paths);
  const brief = briefs.find((entry) => entry.slug === slug);
  if (!brief) notFound();
  const queueBrief = toQueueBrief(brief);

  return (
    <main className="app-shell">
      <nav className="app-nav">
        <div className="app-container flex h-16 items-center justify-between gap-4">
          <Link href="/" className="text-base font-bold text-[var(--text-strong)]"><span className="inline-flex items-center gap-2"><span className="nav-icon" aria-hidden="true">◐</span><span>content-radar</span></span></Link>
          <div className="flex items-center gap-2">
            <Link href="/fila" className="button-secondary px-3 py-2 text-base"><span className="nav-icon" aria-hidden="true">☰</span><span>Fila</span></Link>
            <Link href="/briefs?estado=pendente-publicacao" className="button-primary px-3 py-2 text-base"><span className="nav-icon" aria-hidden="true">▦</span><span>Acervo</span></Link>
            <Link href="/chat" className="button-secondary px-3 py-2 text-base"><span className="nav-icon" aria-hidden="true">◇</span><span>Chat</span></Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>
      <div className="app-container page-section">
        <header className="mb-8">
          <RouteHistory items={[{ label: "Dashboard", href: "/", icon: "◐" }, { label: "Acervo", href: "/briefs?estado=pendente-publicacao", icon: "▦" }, { label: "Aprovados" }, { label: queueBrief.briefId, href: `/briefs/pendente-publicacao/${queueBrief.slug}` }, { label: "Edição", icon: "✎" }]} />
          <p className="eyebrow mt-5 mb-2">Ajuste final</p>
          <h1 className="text-4xl font-semibold text-[var(--text-strong)]">Ajustar brief aprovado</h1>
          <p className="mt-3 max-w-3xl text-base leading-6 muted">{queueBrief.headline ?? queueBrief.slug}</p>
        </header>
        <BriefEditForm brief={queueBrief} state="pendente-publicacao" backHref={`/briefs/pendente-publicacao/${queueBrief.slug}`} />
      </div>
    </main>
  );
}
