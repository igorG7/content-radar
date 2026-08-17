/**
 * Só tema, sessão, @ do Instagram e o vault de demonstração vão para o
 * localStorage — e sempre dentro de try/catch, porque preview e modo privado
 * podem bloquear o acesso. Nenhum dado de brief passa por aqui: a fonte da
 * verdade continua sendo o filesystem.
 */
export function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage bloqueado — a tela segue funcionando sem persistir */
  }
}

export function removeLocal(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* idem */
  }
}
