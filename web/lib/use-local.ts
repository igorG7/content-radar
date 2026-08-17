"use client";

import { useSyncExternalStore } from "react";
import { readLocal, writeLocal } from "./local";

/**
 * localStorage é um sistema externo: ler durante o render quebraria a
 * hidratação (o servidor não tem storage) e ler dentro de um efeito dispara
 * render em cascata. `useSyncExternalStore` é a porta certa — o servidor
 * renderiza o fallback e o cliente troca no primeiro commit.
 */
const listeners = new Set<() => void>();

// Snapshot precisa ser estável entre renders, senão o React entra em laço.
const cache = new Map<string, { bruto: string | null; valor: unknown }>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function snapshot<T>(chave: string, fallback: T): T {
  let bruto: string | null = null;
  try {
    bruto = window.localStorage.getItem(chave);
  } catch {
    return fallback;
  }
  const anterior = cache.get(chave);
  if (anterior && anterior.bruto === bruto) return anterior.valor as T;
  const valor = readLocal(chave, fallback);
  cache.set(chave, { bruto, valor });
  return valor;
}

export function useLocal<T>(chave: string, fallback: T): T {
  return useSyncExternalStore(
    subscribe,
    () => snapshot(chave, fallback),
    () => fallback,
  );
}

/** Grava e avisa todo mundo que lê a mesma chave nesta aba. */
export function setLocal(chave: string, valor: unknown): void {
  writeLocal(chave, valor);
  cache.delete(chave);
  for (const listener of listeners) listener();
}

export function clearLocal(chave: string): void {
  try {
    window.localStorage.removeItem(chave);
  } catch {
    /* storage bloqueado */
  }
  cache.delete(chave);
  for (const listener of listeners) listener();
}
