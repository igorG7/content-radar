import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import { VaultProvider } from "@/components/vault-provider";
import { radarStore } from "@/lib/store";

// O store é lido a cada request, então nada aqui pode ser pré-renderizado.
export const dynamic = "force-dynamic";

export default async function ShellLayout({ children }: LayoutProps<"/">) {
  const { briefs } = await radarStore().listarFila();

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
