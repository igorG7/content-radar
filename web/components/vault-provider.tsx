"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  mapaDe,
  porSlug,
  progressoDe,
  type Aceitos,
  type BlocoMapeado,
  type BlocoVault,
  type Progresso,
} from "@/lib/vault/blocos";

/**
 * O estado do vault vem do servidor, do banco do ambiente da sessão. Antes
 * vivia em `localStorage` com sementes de maquete — o que servia para desenhar
 * a tela e não para operar: o conteúdo não sobrevivia a trocar de navegador,
 * não era do cliente certo, e não tinha histórico.
 *
 * Gravar é ação de servidor. Aqui só se lê.
 */

interface VaultContextValue {
  aceitos: Aceitos;
  mapa: BlocoMapeado[];
  progresso: Progresso;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function useVault() {
  const value = useContext(VaultContext);
  if (!value) throw new Error("useVault precisa de um <VaultProvider> acima");
  return value;
}

export function VaultProvider({
  blocos,
  configuracao,
  children,
}: {
  blocos: BlocoVault[];
  configuracao: { temFontes: boolean; temAjustes: boolean };
  children: ReactNode;
}) {
  const value = useMemo<VaultContextValue>(() => {
    const aceitos = porSlug(blocos, configuracao);
    return { aceitos, mapa: mapaDe(aceitos), progresso: progressoDe(aceitos) };
  }, [blocos, configuracao]);

  return (
    <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
  );
}
