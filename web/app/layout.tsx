import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "content-radar",
  description:
    "Painel editorial para revisar briefs e configurar o radar de conteúdo",
};

// Roda antes da primeira pintura: sem isso o tema claro pisca antes do escuro.
// Só o escuro carimba `data-theme` — o claro é o default do CSS.
const THEME_SCRIPT = `
(() => {
  try {
    const t = localStorage.getItem('radar-theme');
    if (t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.dataset.theme = 'dark';
    }
  } catch {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
