import { readFile } from "node:fs/promises";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { RouteHistory } from "@/components/route-history";
import { loadManifest, MANIFEST_PATH } from "@/lib/manifest";
import { validateManifestText } from "@/lib/config/validate";
import { ConfigForm, type ConfigData } from "@/components/config-form";

export const dynamic = "force-dynamic";

export default async function Config() {
  const manifest = await loadManifest();
  const { warnings } = validateManifestText(await readFile(MANIFEST_PATH, "utf8"));

  const initial: ConfigData = {
    scopes: Object.entries(manifest.search_scopes).map(([key, scope]) => ({
      key,
      label: scope.label,
      sources: scope.sources,
      pillarsAlvo: scope.pillars_alvo ?? [],
    })),
    candidatesPerWeek: manifest.funnel.candidates_per_week_target,
    matchScoreMin: manifest.anti_repetition.match_score_min,
    borderlineMin: manifest.anti_repetition.borderline_min,
    weights: manifest.anti_repetition.match_score_weights,
    warnings,
  };

  return (
    <main className="app-shell">
      <nav className="app-nav">
        <div className="app-container-narrow flex h-16 items-center justify-between gap-4">
          <Link href="/" className="text-base font-bold text-[var(--text-strong)]">
            <span className="inline-flex items-center gap-2"><span className="nav-icon" aria-hidden="true">◐</span><span>content-radar</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/fila" className="button-secondary px-3 py-2 text-base"><span className="nav-icon" aria-hidden="true">☰</span><span>Fila</span></Link>
            <Link href="/briefs" className="button-secondary px-3 py-2 text-base"><span className="nav-icon" aria-hidden="true">▦</span><span>Acervo</span></Link>
            <Link href="/chat" className="button-secondary px-3 py-2 text-base"><span className="nav-icon" aria-hidden="true">◇</span><span>Chat</span></Link>
            <Link href="/config" className="button-primary px-3 py-2 text-base"><span className="nav-icon" aria-hidden="true">⚙</span><span>Configuração</span></Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="app-container-narrow page-section">
        <header className="mb-8">
          <RouteHistory items={[{ label: "Dashboard", href: "/", icon: "◐" }, { label: "Configuração", icon: "⚙" }]} />
          <p className="eyebrow mt-5 mb-2">Ajustes operacionais</p>
          <h1 className="text-4xl font-semibold text-[var(--text-strong)]">Configuração</h1>
          <p className="mt-3 max-w-2xl text-base leading-6 muted">
            Edita <span className="font-mono">manifest.yaml</span> diretamente. Só os campos alterados
            são reescritos; comentários e formatação do resto do arquivo ficam intactos.
          </p>
        </header>

        <ConfigForm initial={initial} />
      </div>
    </main>
  );
}
