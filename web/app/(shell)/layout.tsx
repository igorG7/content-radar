import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import { VaultProvider } from "@/components/vault-provider";
import { radarStore } from "@/lib/store";
import { nomeDeExibicao, sessaoAtual } from "@/lib/sessao";

// O store é lido a cada request, então nada aqui pode ser pré-renderizado.
export const dynamic = "force-dynamic";

export default async function ShellLayout({ children }: LayoutProps<"/">) {
  // A guarda vive no layout do shell, não em cada página: é a fronteira do
  // app, e a camada de armazenamento recusa sem sessão de qualquer forma —
  // aqui a recusa vira redirecionamento em vez de erro.
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/login");

  const nome = await nomeDeExibicao(sessao);
  const store = await radarStore();
  const [{ briefs }, blocos, configuracao] = await Promise.all([
    store.listarFila(),
    store.listarBlocos(),
    store.estadoDaConfig(),
  ]);

  return (
    <Suspense>
      <VaultProvider blocos={blocos} configuracao={configuracao}>
        <ToastProvider>
          {/* A sessão desce do servidor. A casca mantinha uma própria no
              navegador, de demonstração, e exibia um e-mail fictício para quem
              tinha acabado de entrar com o seu. */}
          <AppShell
            filaCount={briefs.length}
            sessao={{
              email: sessao.email,
              ambiente: sessao.ambienteNome,
              nome,
            }}
          >
            {children}
          </AppShell>
        </ToastProvider>
      </VaultProvider>
    </Suspense>
  );
}
