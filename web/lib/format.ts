/**
 * O store grava tudo em -03:00 e a operação é uma só. Fixar o fuso evita que a
 * mesma data apareça em dias diferentes conforme o relógio de quem abre.
 */
export const TZ = "America/Sao_Paulo";
const TZ_OFFSET_MIN = -180;

export const fmtScore = (n: number) => n.toFixed(3).replace(".", ",");
export const fmtPct = (n: number) => `${Math.round(n * 100)}%`;

export function fmtDate(iso: string, withTime = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TZ,
  });
  if (!withTime) return date;
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  return `${date} · ${time}`;
}

export function fmtRelative(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return iso;
  const diff = (now.getTime() - then.getTime()) / 1000;
  if (diff < 0) return fmtDate(iso);
  if (diff < 3600) return `há ${Math.max(1, Math.round(diff / 60))} min`;
  if (diff < 86400) return `há ${Math.round(diff / 3600)} h`;
  const days = Math.round(diff / 86400);
  if (days < 30) return `há ${days} ${days === 1 ? "dia" : "dias"}`;
  return fmtDate(iso);
}

export function weekLabel(week: string): string {
  const [year, num] = week.split("-W");
  return num ? `Semana ${num} de ${year}` : week;
}

/** `2026-W26-011` → `2026-W26`; é o que agrupa o acervo. */
export function weekOf(briefId: string): string {
  const match = /^(\d{4}-W\d{2})/.exec(briefId);
  return match ? match[1] : "sem-semana";
}

/** O datetime-local não carrega fuso: a conversão é explícita nos dois sentidos. */
export const paraCampo = (d: Date) =>
  new Date(d.getTime() + TZ_OFFSET_MIN * 60000).toISOString().slice(0, 16);

export const doCampo = (v: string) => `${v}:00-03:00`;
