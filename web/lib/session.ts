"use client";

import { clearLocal, setLocal, useLocal } from "./use-local";

const SESSION_KEY = "radar-sessao";
const HANDLE_KEY = "radar-ig-handle";

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
  setLocal(SESSION_KEY, sessao);
  return sessao;
}

export function sair(): void {
  clearLocal(SESSION_KEY);
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
