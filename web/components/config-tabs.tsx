"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconSliders, IconVault } from "@/components/ui/icons";
import { useVault } from "@/components/vault-provider";

/**
 * Duas superfícies com naturezas diferentes: Operação é número com invariante
 * verificável na gravação; Vault é prosa cujo efeito só aparece na próxima
 * varredura. O badge mostra quantos blocos obrigatórios ainda faltam.
 */
export function ConfigTabs() {
  const pathname = usePathname();
  const { progresso } = useVault();
  const noVault = pathname.startsWith("/config/vault");

  return (
    <nav className="tabbar" aria-label="Seções da configuração">
      <Link href="/config" aria-current={noVault ? undefined : "page"}>
        <IconSliders />
        <span>Operação</span>
      </Link>
      <Link href="/config/vault" aria-current={noVault ? "page" : undefined}>
        <IconVault />
        <span>Vault</span>
        {progresso.faltam.length > 0 && (
          <span className="nav-badge">{progresso.faltam.length}</span>
        )}
      </Link>
    </nav>
  );
}
