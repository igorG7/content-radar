"use client";

import { clearLocal, setLocal, useLocal } from "./use-local";
import { readLocal } from "./local";

const SESSION_KEY = "radar-sessao";
const SAIU_KEY = "radar-sessao-saiu";
const HANDLE_KEY = "radar-ig-handle";
const NOME_KEY = "radar-perfil-nome";
const MODELO_KEY = "radar-chat-modelo";
const ESFORCO_KEY = "radar-chat-esforco";

export interface Sessao {
  email: string;
  entrou_em: string;
}

/**
 * Não existe backend de autenticação: a sessão é um registro local que
 * demonstra o fluxo entrar → usar → sair. Não há guarda de rota.
 */
export function useSessao(): Sessao | null {
  return useLocal<Sessao | null>(SESSION_KEY, null);
}

export function entrar(email: string): Sessao {
  const sessao: Sessao = { email, entrou_em: new Date().toISOString() };
  clearLocal(SAIU_KEY);
  setLocal(SESSION_KEY, sessao);
  return sessao;
}

export function sair(): void {
  clearLocal(SESSION_KEY);
  // Marca a saída explícita para a sessão de demonstração não renascer na
  // próxima tela — senão o "Sair" pareceria quebrado.
  setLocal(SAIU_KEY, true);
}

/**
 * O painel abre com um usuário, para a barra nunca ficar sem identidade: sem
 * backend, quem abre não passou por login algum e barra sem identidade parece
 * defeito. Depois de sair de propósito, a barra passa a oferecer "Entrar" e
 * nada é recriado.
 */
export const USUARIO_DEMO = "editor@empresa.com.br";

export function garantirSessao(): void {
  if (readLocal<Sessao | null>(SESSION_KEY, null)) return;
  if (readLocal<boolean>(SAIU_KEY, false)) return;
  entrar(USUARIO_DEMO);
}

/** O e-mail é a chave da sessão; o nome de exibição é escolha da pessoa. */
export function useNome(sessao: Sessao | null): string {
  const salvo = useLocal<string>(NOME_KEY, "");
  if (salvo) return salvo;
  return sessao ? sessao.email.split("@")[0] : "";
}

export function gravarNome(nome: string): void {
  setLocal(NOME_KEY, nome);
}

/** O @ que aparece no cabeçalho da prévia do post. O manifest não guarda isso. */
export const HANDLE_PADRAO = "suamarca";
export const HANDLE_OK = /^[a-z0-9._]{1,30}$/;

export function useHandle(): string {
  return useLocal<string>(HANDLE_KEY, HANDLE_PADRAO);
}

export function gravarHandle(handle: string): void {
  setLocal(HANDLE_KEY, handle);
}

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

function valido<T extends string>(valor: string, opcoes: readonly { id: T }[], padrao: T): T {
  return opcoes.some((o) => o.id === valor) ? (valor as T) : padrao;
}

export function useModelo(): ModeloId {
  return valido(useLocal<string>(MODELO_KEY, MODELO_PADRAO), CHAT_MODELOS, MODELO_PADRAO);
}

export function useEsforco(): EsforcoId {
  return valido(useLocal<string>(ESFORCO_KEY, ESFORCO_PADRAO), CHAT_ESFORCOS, ESFORCO_PADRAO);
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
