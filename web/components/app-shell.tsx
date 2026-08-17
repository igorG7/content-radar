"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import {
  IconLogout,
  IconMoon,
  IconSun,
  IconUser,
  NAV_ICONS,
  type NavIconName,
} from "@/components/ui/icons";
import { useVault } from "@/components/vault-provider";
import { garantirSessao, sair, useNome, useSessao } from "@/lib/session";

interface Rota {
  key: string;
  href: string;
  label: string;
  icon: NavIconName;
}

/**
 * O vault deixou de ter entrada própria: virou aba da Configuração. O badge
 * mantém visível o que a entrada perdida sinalizava — quantos blocos
 * obrigatórios ainda seguram a varredura.
 */
const ROTAS: Rota[] = [
  { key: "painel", href: "/", label: "Painel", icon: "layout" },
  { key: "fila", href: "/fila", label: "Fila", icon: "inbox" },
  { key: "acervo", href: "/acervo", label: "Acervo", icon: "archive" },
  { key: "chat", href: "/chat", label: "Chat", icon: "bubble" },
  { key: "ledger", href: "/ledger", label: "Ledger", icon: "ledger" },
  { key: "config", href: "/config", label: "Configuração", icon: "sliders" },
];

function rotaAtiva(pathname: string): string {
  if (pathname === "/") return "painel";
  if (pathname.startsWith("/fila")) return "fila";
  if (pathname.startsWith("/acervo")) return "acervo";
  if (pathname.startsWith("/chat")) return "chat";
  if (pathname.startsWith("/ledger")) return "ledger";
  if (pathname.startsWith("/config")) return "config";
  if (pathname.startsWith("/perfil")) return "perfil";
  // O detalhe do brief pertence à fila ou ao acervo conforme o estado no disco.
  if (pathname.startsWith("/briefs/pendente-aprovacao")) return "fila";
  if (pathname.startsWith("/briefs")) return "acervo";
  return "";
}

/**
 * O tema mora no `data-theme` do <html>, escrito pelo script do <head> antes da
 * primeira pintura. Não há estado de React aqui de propósito: qual ícone
 * aparece é decisão do CSS, então o botão nunca discorda do que está na tela.
 */
function ThemeToggle() {
  function alternar() {
    const proximo = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    if (proximo === "dark") document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    // Chave crua, sem JSON: é assim que o script inline do <head> a lê.
    try {
      localStorage.setItem("radar-theme", proximo);
    } catch {
      /* modo privado */
    }
  }

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={alternar}
      aria-label="Alternar entre tema claro e escuro"
    >
      <span className="icon-moon">
        <IconMoon />
      </span>
      <span className="icon-sun">
        <IconSun />
      </span>
    </button>
  );
}

export function AppShell({ children, filaCount }: { children: ReactNode; filaCount: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const { progresso } = useVault();
  const sessao = useSessao();
  const nome = useNome(sessao);
  const ativa = rotaAtiva(pathname);

  // Escrever no storage é efeito sobre um sistema externo, não estado: quem
  // relê a sessão é o `useSessao` acima, pelo mesmo canal.
  useEffect(garantirSessao, []);

  function badgeDe(key: string): number {
    // Sem os blocos obrigatórios não existe fila: nada foi varrido ainda.
    if (key === "fila") return progresso.podeRodar ? filaCount : 0;
    if (key === "config") return progresso.faltam.length;
    return 0;
  }

  return (
    <>
      <a className="sr-only" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="app-nav">
        <div className="app-nav-inner">
          <Link className="brand" href="/" aria-label="content-radar — painel editorial">
            <span className="brand-mark">content&#8203;·radar</span>
          </Link>
          <nav className="nav-links" aria-label="Navegação principal">
            {ROTAS.map((rota) => {
              const Icone = NAV_ICONS[rota.icon];
              const n = badgeDe(rota.key);
              return (
                <Link
                  key={rota.key}
                  className="nav-link"
                  href={rota.href}
                  aria-current={ativa === rota.key ? "page" : undefined}
                >
                  <span className="nav-icon" aria-hidden="true">
                    <Icone />
                  </span>
                  <span>{rota.label}</span>
                  {n > 0 && <span className="nav-badge">{n}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="nav-tail">
            {sessao ? (
              <Link
                className="nav-user"
                href="/perfil"
                title={`Perfil de ${sessao.email}`}
                aria-current={ativa === "perfil" ? "page" : undefined}
              >
                <span className="nav-user-mark" aria-hidden="true">
                  {nome.charAt(0).toUpperCase()}
                </span>
                <span className="nav-user-txt">
                  <span className="nav-user-nome">{nome}</span>
                </span>
              </Link>
            ) : (
              <Link className="nav-user" href="/login" title="Entrar no painel">
                <span className="nav-user-mark" aria-hidden="true">
                  <IconUser />
                </span>
                <span className="nav-user-txt">
                  <span className="nav-user-nome">Entrar</span>
                </span>
              </Link>
            )}
            <ThemeToggle />
            <span className="nav-sep" aria-hidden="true" />
            <button
              className="theme-toggle"
              type="button"
              title={sessao ? "Sair" : "Entrar"}
              aria-label={sessao ? `Sair da conta ${sessao.email}` : "Ir para a tela de login"}
              onClick={() => {
                sair();
                router.push("/login");
              }}
            >
              <IconLogout />
            </button>
          </div>
        </div>
      </header>

      <main className="app-container app-main" id="conteudo">
        {children}
      </main>
    </>
  );
}
