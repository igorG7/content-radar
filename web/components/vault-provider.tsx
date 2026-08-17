"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { setLocal, useLocal } from "@/lib/use-local";
import {
  SEEDS,
  mapaDe,
  progressoDe,
  type Aceitos,
  type BlocoMapeado,
  type ModoVault,
  type Progresso,
} from "@/lib/vault/blocos";

const KEY_BLOCOS = "radar-vault";
const KEY_MODO = "radar-vault-modo";

interface VaultContextValue {
  modo: ModoVault;
  aceitos: Aceitos;
  mapa: BlocoMapeado[];
  progresso: Progresso;
  aceitar: (key: string, conteudo: string | null, motivo: string | null) => void;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function useVault() {
  const value = useContext(VaultContext);
  if (!value) throw new Error("useVault precisa de um <VaultProvider> acima");
  return value;
}

function ehModo(valor: string | null): valor is ModoVault {
  return valor === "completo" || valor === "onboarding";
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const params = useSearchParams();
  const modoUrl = params.get("vault");
  const modoSalvo = useLocal<ModoVault>(KEY_MODO, "completo");
  const modo: ModoVault = ehModo(modoUrl) ? modoUrl : modoSalvo;

  // A escolha vinda da URL persiste como o tema — gravar é efeito sobre um
  // sistema externo, não estado de React.
  useEffect(() => {
    if (ehModo(modoUrl) && modoUrl !== modoSalvo) setLocal(KEY_MODO, modoUrl);
  }, [modoUrl, modoSalvo]);

  // Aceito = versão. Não existe rascunho meio-salvo: bloco não confirmado ainda
  // não existe, e retomar é continuar de onde a lista de vazios começa.
  const salvo = useLocal<{ modo: ModoVault; blocos: Aceitos } | null>(KEY_BLOCOS, null);
  const aceitos = useMemo<Aceitos>(
    () => (salvo && salvo.modo === modo ? salvo.blocos : (SEEDS[modo] ?? {})),
    [salvo, modo],
  );

  const aceitar = useCallback(
    (key: string, conteudo: string | null, motivo: string | null) => {
      const anterior = aceitos[key];
      const proximo: Aceitos = {
        ...aceitos,
        [key]: {
          versao: anterior ? anterior.versao + 1 : 1,
          em: new Date().toISOString(),
          motivo,
          conteudo,
        },
      };
      setLocal(KEY_BLOCOS, { modo, blocos: proximo });
    },
    [aceitos, modo],
  );

  const value = useMemo<VaultContextValue>(
    () => ({
      modo,
      aceitos,
      mapa: mapaDe(aceitos),
      progresso: progressoDe(aceitos),
      aceitar,
    }),
    [modo, aceitos, aceitar],
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}
