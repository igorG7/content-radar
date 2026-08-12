import Link from "next/link";
import { AgentChat } from "@/components/agent-chat";
import { RouteHistory } from "@/components/route-history";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

export default function ChatPage() {
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
            <Link href="/chat" className="button-primary px-3 py-2 text-base"><span className="nav-icon" aria-hidden="true">◇</span><span>Chat</span></Link>
            <Link href="/config" className="button-secondary px-3 py-2 text-base"><span className="nav-icon" aria-hidden="true">⚙</span><span>Configuração</span></Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="app-container page-section">
        <header className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
          <div>
            <RouteHistory items={[{ label: "Dashboard", href: "/" }, { label: "Chat" }]} />
            <p className="eyebrow mt-5 mb-2">Agente editorial</p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-[var(--text-strong)]">Chat com o agente</h1>
            <p className="mt-3 max-w-2xl text-base leading-6 muted">
              Espaço dedicado para conversar com o agente, consultar contexto dos briefs e acionar fluxos assistidos.
            </p>
          </div>
          <aside className="surface p-4">
            <p className="eyebrow">Status</p>
            <p className="mt-3 text-base font-semibold text-[var(--text-strong)]">Interface pronta</p>
            <p className="mt-1 text-sm muted">A conexão com o agente entra na próxima etapa.</p>
          </aside>
        </header>

        <AgentChat />
      </div>
    </main>
  );
}
