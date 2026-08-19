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

/** Writers disagree on whether `event` is top-level or inside `extra`. */
function normalize(parsed: Record<string, unknown>): LedgerEvent {
  const extra = parsed.extra as Record<string, unknown> | undefined;
  const event = parsed.event ?? extra?.event;
  return {
    ...parsed,
    event: typeof event === "string" ? event : "unknown",
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
