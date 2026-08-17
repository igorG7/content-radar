import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import { VaultProvider } from "@/components/vault-provider";
import { loadManifest, resolvePaths } from "@/lib/manifest";
import { listState } from "@/lib/store/briefs";

// O store é lido do disco a cada request, então nada aqui pode ser pré-renderizado.
export const dynamic = "force-dynamic";

export default async function ShellLayout({ children }: LayoutProps<"/">) {
  const paths = resolvePaths(await loadManifest());
  const { briefs } = await listState("pendente-aprovacao", paths);

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
