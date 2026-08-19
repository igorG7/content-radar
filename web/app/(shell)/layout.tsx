import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import { VaultProvider } from "@/components/vault-provider";
import { radarStore } from "@/lib/store";
import { sessaoAtual } from "@/lib/sessao";

// O store é lido a cada request, então nada aqui pode ser pré-renderizado.
export const dynamic = "force-dynamic";

export default async function ShellLayout({ children }: LayoutProps<"/">) {
  // A guarda vive no layout do shell, não em cada página: é a fronteira do
  // app, e a camada de armazenamento recusa sem sessão de qualquer forma —
  // aqui a recusa vira redirecionamento em vez de erro.
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/login");

  const store = await radarStore();
  const { briefs } = await store.listarFila();

  return (
    <Suspense>
      <VaultProvider>
        <ToastProvider>
          <AppShell filaCount={briefs.length}>{children}</AppShell>
        </ToastProvider>
      </VaultProvider>
    </Suspense>
  );
}
