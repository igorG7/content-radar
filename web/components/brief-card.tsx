"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface QueueCandidate {
  index: number;
  fileName: string | null;
  exists: boolean;
  alt?: string;
  licenseHint?: string;
  licensable?: boolean;
}

export interface QueueBrief {
  slug: string;
  briefId: string;
  headline?: string;
  hook?: string;
  pillar?: string;
  icp?: string;
  matchScore?: number;
  borderline: boolean;
  borderlineReason?: string;
  whyMatch?: string;
  sourceUrls: string[];
  storedHeroChoice: number | null | undefined;
  candidates: QueueCandidate[];
}

/** `undefined` means the human has not chosen in this session. A hero_choice
 *  already in the file does not count: the briefer writes `null` by default
 *  (spec 004 §8.3), so a stored null is indistinguishable from an unmade choice. */
type Pick = number | "none" | undefined;

export function BriefCard({ brief }: { brief: QueueBrief }) {
  const router = useRouter();
  const [pick, setPick] = useState<Pick>(undefined);
  const [confirmingNone, setConfirmingNone] = useState(false);
  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cached = brief.candidates.filter((candidate) => candidate.exists && candidate.fileName);
  const hasPhotos = cached.length > 0;

  async function savePick(next: Pick) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/briefs/${brief.slug}/hero`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ heroChoice: next === "none" ? null : next }),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "falha ao gravar");
      setPick(next);
      setConfirmingNone(false);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function transition(direction: "approve" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/briefs/${brief.slug}/transition`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ direction, reason: reason.trim() || undefined }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "falha na transição");
      router.refresh();
    } catch (cause) {
      setError((cause as Error).message);
      setBusy(false);
    }
  }

  const storedLabel =
    brief.storedHeroChoice === undefined
      ? "campo ausente"
      : brief.storedHeroChoice === null
        ? "null (default do briefer)"
        : `foto ${brief.storedHeroChoice}`;

  return (
    <li className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <span className="font-mono">{brief.briefId}</span>
        {brief.pillar && <span>· {brief.pillar}</span>}
        {brief.icp && <span>· {brief.icp}</span>}
        {brief.matchScore !== undefined ? <span>· score {brief.matchScore}</span> : <span>· sem score</span>}
        {brief.borderline && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-100">
            borderline
          </span>
        )}
      </div>

      <h3 className="mt-1 font-medium">{brief.headline ?? brief.slug}</h3>
      {brief.hook && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{brief.hook}</p>}

      {brief.whyMatch && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-xs text-zinc-500">por que casou</summary>
          <p className="mt-1 whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">{brief.whyMatch}</p>
        </details>
      )}

      <div className="mt-4">
        <div className="mb-2 text-xs text-zinc-500">
          Escolha a arte · gravado no arquivo: {storedLabel}
        </div>

        <div className="flex flex-wrap items-start gap-3">
          {cached.map((candidate) => (
            <button
              key={candidate.index}
              type="button"
              disabled={busy}
              onClick={() => savePick(candidate.index)}
              className={`rounded border-2 p-1 ${
                pick === candidate.index
                  ? "border-blue-600"
                  : "border-transparent hover:border-zinc-300"
              }`}
              title={candidate.licenseHint ?? undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/media/pendente-aprovacao/${encodeURIComponent(candidate.fileName!)}`}
                alt={candidate.alt ?? `candidata ${candidate.index}`}
                className="h-24 w-24 rounded object-cover"
              />
              {candidate.licensable === false && (
                <span className="mt-1 block text-[10px] text-amber-700 dark:text-amber-500">
                  uso referencial
                </span>
              )}
            </button>
          ))}

          {!hasPhotos && (
            <p className="text-sm text-zinc-500">
              Nenhuma candidata em cache — a arte gerada é o único caminho.
            </p>
          )}
        </div>

        <div className="mt-3">
          {confirmingNone ? (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950">
              <p>
                Aprovar sem foto apaga {cached.length} candidata(s) do cache local. Como nada foi para o
                Cloudinary ainda, isso é irreversível.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => savePick("none")}
                  className="rounded bg-amber-600 px-3 py-1 text-white disabled:opacity-50"
                >
                  Confirmar
                </button>
                <button type="button" onClick={() => setConfirmingNone(false)} className="px-3 py-1">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => (hasPhotos ? setConfirmingNone(true) : savePick("none"))}
              className={`rounded border px-3 py-1 text-sm ${
                pick === "none"
                  ? "border-blue-600 text-blue-700 dark:text-blue-400"
                  : "border-zinc-300 dark:border-zinc-700"
              }`}
            >
              Sem foto — o Smart Design gera a arte
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <button
          type="button"
          disabled={busy || pick === undefined}
          onClick={() => transition("approve")}
          className="rounded bg-emerald-600 px-4 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
          title={pick === undefined ? "escolha a arte antes de aprovar" : undefined}
        >
          Aprovar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setShowReject((value) => !value)}
          className="rounded border border-zinc-300 px-4 py-1.5 text-sm dark:border-zinc-700"
        >
          Rejeitar
        </button>
        {pick === undefined && (
          <span className="text-xs text-zinc-500">escolha a arte para liberar a aprovação</span>
        )}
      </div>

      {showReject && (
        <div className="mt-3">
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Motivo da rejeição (vai para review_notes)"
            className="w-full rounded border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            rows={2}
          />
          <p className="mt-1 text-xs text-zinc-500">
            Rejeitar apaga todas as mídias e é terminal — o .md fica em rejeitado/ para a
            anti-repetição.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => transition("reject")}
            className="mt-2 rounded bg-red-600 px-4 py-1.5 text-sm text-white disabled:opacity-50"
          >
            Confirmar rejeição
          </button>
        </div>
      )}
    </li>
  );
}
