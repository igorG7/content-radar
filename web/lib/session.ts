"use client";

import { setLocal, useLocal } from "./use-local";

const MODELO_KEY = "radar-chat-modelo";
const ESFORCO_KEY = "radar-chat-esforco";

/**
 * O que ainda mora no navegador — e o que deixou de morar.
 *
 * A sessão saiu daqui. Havia uma de mentira: `USUARIO_DEMO`, fabricada a cada
 * render quando não existia nenhuma, com o comentário "não existe backend de
 * autenticação, não há guarda de rota". Isso era verdade na maquete e deixou de
 * ser — há cookie assinado, argon2 e 401 nas rotas —, mas a tela continuou
 * exibindo o e-mail fictício para quem tinha acabado de entrar com o seu.
 *
 * O que sobra aqui é preferência de máquina: modelo e esforço do chat. O nome
 * de exibição foi para a tabela `usuario` e o @ do Instagram para `marca` — o
 * primeiro é da pessoa, o segundo do cliente, e nenhum dos dois é da máquina
 * em que se abriu o navegador.
 */

/**
 * Modelo e esforço do chat. Ficam aqui porque o chat escolhe e o perfil
 * também — duas listas divergiriam no primeiro modelo novo. Os nomes são
 * tiers de capacidade, não modelos de um fornecedor: quem ligar o endpoint
 * troca `id` pelo identificador real sem mexer na tela.
 */
export const CHAT_MODELOS = [
  {
    id: "rapido",
    label: "Rápido",
    nota: "Triagem e perguntas diretas sobre a fila. Responde em segundos.",
  },
  {
    id: "padrao",
    label: "Padrão",
    nota: "O do dia a dia: lê o store, cruza pilar e ICP, escreve copy.",
  },
  {
    id: "profundo",
    label: "Profundo",
    nota: "Análise longa — comparar semanas, revisar pesos, auditar repetição.",
  },
] as const;

export const CHAT_ESFORCOS = [
  { id: "baixo", label: "baixo" },
  { id: "medio", label: "médio" },
  { id: "alto", label: "alto" },
] as const;

export type ModeloId = (typeof CHAT_MODELOS)[number]["id"];
export type EsforcoId = (typeof CHAT_ESFORCOS)[number]["id"];

const MODELO_PADRAO: ModeloId = "padrao";
const ESFORCO_PADRAO: EsforcoId = "medio";

function valido<T extends string>(
  valor: string,
  opcoes: readonly { id: T }[],
  padrao: T,
): T {
  return opcoes.some((o) => o.id === valor) ? (valor as T) : padrao;
}

export function useModelo(): ModeloId {
  return valido(
    useLocal<string>(MODELO_KEY, MODELO_PADRAO),
    CHAT_MODELOS,
    MODELO_PADRAO,
  );
}

export function useEsforco(): EsforcoId {
  return valido(
    useLocal<string>(ESFORCO_KEY, ESFORCO_PADRAO),
    CHAT_ESFORCOS,
    ESFORCO_PADRAO,
  );
}

export function gravarModelo(id: ModeloId): void {
  setLocal(MODELO_KEY, id);
}

export function gravarEsforco(id: EsforcoId): void {
  setLocal(ESFORCO_KEY, id);
}

/**
 * O perfil relata se a sessão sobrevive ao recarregar. É sonda, não escrita de
 * estado: usa o storage cru de propósito — `setLocal` avisaria os assinantes e
 * dispararia render em cadeia a partir de quem só queria saber se dá para gravar.
 */
export function armazenamentoDisponivel(): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem("radar-probe", "1");
    window.localStorage.removeItem("radar-probe");
    return true;
  } catch {
    return false;
  }
}

export const rotuloModelo = (id: string) =>
  CHAT_MODELOS.find((m) => m.id === id)?.label ?? id;
export const rotuloEsforco = (id: string) =>
  CHAT_ESFORCOS.find((e) => e.id === id)?.label ?? id;
