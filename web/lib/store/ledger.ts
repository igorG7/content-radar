import { appendFile, readFile } from "node:fs/promises";

export interface LedgerEvent {
  ts: string;
  event: string;
  actor?: string;
  brief_id?: string | null;
  scan_id?: string | null;
  from_dir?: string | null;
  to_dir?: string | null;
  extra?: Record<string, unknown>;
}

export interface LedgerReadResult {
  events: LedgerEvent[];
  /** Line numbers that failed to parse — surfaced instead of silently dropped. */
  malformedLines: number[];
}

/**
 * Os escritores discordam sobre onde os campos moram — no topo ou dentro de
 * `extra`. E discordam **entre execuções**: a mesma skill escreveu `brief_id`
 * no topo numa varredura e dentro de `extra` noutra.
 *
 * Ler um lugar só não dá erro, dá silêncio. O `event` fora do lugar virava
 * `desconhecido`; o `brief_id` fora do lugar deixava o evento sem vínculo, e a
 * linha do tempo do brief aparecia **vazia** — foi assim que o `2026-W34-001`
 * passou de nascimento não registrado, quando o registro existia o tempo todo,
 * solto.
 */
const doTopoOuDoExtra = (
  parsed: Record<string, unknown>,
  extra: Record<string, unknown> | undefined,
  campo: string,
): string | undefined => {
  const valor = parsed[campo] ?? extra?.[campo];
  return typeof valor === "string" && valor !== "" ? valor : undefined;
};

function normalize(parsed: Record<string, unknown>): LedgerEvent {
  const extra = parsed.extra as Record<string, unknown> | undefined;
  const event = doTopoOuDoExtra(parsed, extra, "event");
  return {
    ...parsed,
    event: event ?? "unknown",
    brief_id: doTopoOuDoExtra(parsed, extra, "brief_id") ?? null,
    scan_id: doTopoOuDoExtra(parsed, extra, "scan_id") ?? null,
  } as LedgerEvent;
}

export async function readLedger(
  ledgerPath: string,
): Promise<LedgerReadResult> {
  let raw: string;
  try {
    raw = await readFile(ledgerPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { events: [], malformedLines: [] };
    }
    throw error;
  }

  const events: LedgerEvent[] = [];
  const malformedLines: number[] = [];

  raw.split("\n").forEach((line, index) => {
    if (line.trim() === "") return;
    try {
      events.push(normalize(JSON.parse(line)));
    } catch {
      malformedLines.push(index + 1);
    }
  });

  return { events, malformedLines };
}

/** Every event written by the app carries this actor, so the ledger keeps
 *  showing which transitions came from the UI and which from the terminal. */
export const APP_ACTOR = "app:radar-web";

export async function appendLedger(
  ledgerPath: string,
  event: Omit<LedgerEvent, "ts"> & { ts?: string },
): Promise<LedgerEvent> {
  const entry: LedgerEvent = {
    ts: event.ts ?? new Date().toISOString(),
    ...event,
  };
  await appendFile(ledgerPath, `${JSON.stringify(entry)}\n`, "utf8");
  return entry;
}
