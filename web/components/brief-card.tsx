"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Link from "next/link";
import { BriefDetail } from "./brief-detail";
import type { QueueBrief } from "./queue-types";

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
  const [showDetail, setShowDetail] = useState(false);

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
    <li className="panel overflow-hidden">
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm muted">
            <span className="font-mono">{brief.briefId}</span>
            {brief.pillar && <span>{brief.pillar}</span>}
            {brief.icp && <span>{brief.icp}</span>}
            {brief.matchScore !== undefined ? <span>score {brief.matchScore}</span> : <span>sem score</span>}
            {brief.borderline && <span className="pill pill-warning px-2 py-1">borderline</span>}
          </div>

          <h2 className="mt-3 text-2xl font-semibold leading-snug text-[var(--text-strong)]">
            {brief.headline ?? brief.slug}
          </h2>
          {brief.hook && <p className="mt-2 max-w-2xl text-base leading-6 muted">{brief.hook}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowDetail(true)}
              className="text-link text-base"
            >
              Ver pop-up
            </button>
            <Link href={`/fila/${brief.slug}`} className="text-link text-base">
              Abrir página
            </Link>
            <span className="text-sm muted">arte gravada: {storedLabel}</span>
          </div>

          {showDetail && <BriefDetail brief={brief} onClose={() => setShowDetail(false)} />}
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold uppercase muted">Arte candidata</p>
          <div className="grid grid-cols-3 gap-2">
            {cached.map((candidate) => (
              <button
                key={candidate.index}
                type="button"
                disabled={busy}
                onClick={() => savePick(candidate.index)}
                className={`group relative aspect-square overflow-hidden rounded-lg border bg-[color:var(--surface-soft-strong)] ${
                  pick === candidate.index
                    ? "border-[color:var(--text-accent)] shadow-[0_0_0_3px_rgba(116,140,171,0.22)]"
                    : "border-[color:var(--line)] hover:border-[#748CAB]"
                }`}
                title={candidate.licenseHint ?? undefined}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/media/pendente-aprovacao/${encodeURIComponent(candidate.fileName!)}`}
                  alt={candidate.alt ?? `candidata ${candidate.index}`}
                  className="h-full w-full object-cover"
                />
                <span className="absolute left-1.5 top-1.5 rounded bg-[rgba(13,19,33,0.78)] px-1.5 py-0.5 font-mono text-[10px] text-white">
                  {candidate.index}
                </span>
                {candidate.licensable === false && (
                  <span className="absolute inset-x-1.5 bottom-1.5 rounded bg-[#fff4cf] px-1.5 py-0.5 text-[10px] font-semibold text-[#7b4b12]">
                    referencial
                  </span>
                )}
              </button>
            ))}
            {!hasPhotos && (
              <div className="col-span-3 rounded-lg border border-dashed border-[color:var(--line-strong)] bg-[color:var(--surface-soft-strong)] p-4 text-base muted">
                Nenhuma candidata em cache. O Smart Design gera a arte.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-[color:var(--line)] bg-[color:var(--surface-soft-alpha)] px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          {confirmingNone ? (
            <div className="alert-warning w-full p-3 text-base">
              <p>
                Aprovar sem foto apaga {cached.length} candidata(s) do cache local. Como nada foi para o
                Cloudinary ainda, isso é irreversível.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => savePick("none")}
                  className="button-primary px-3 py-1.5 text-base"
                >
                  Confirmar sem foto
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingNone(false)}
                  className="button-secondary px-3 py-1.5 text-base"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                disabled={busy || pick === undefined}
                onClick={() => transition("approve")}
                className="button-primary px-4 py-2 text-base"
                title={pick === undefined ? "escolha a arte antes de aprovar" : undefined}
              >
                Aprovar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowReject((value) => !value)}
                className="button-secondary px-4 py-2 text-base"
              >
                Rejeitar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => (hasPhotos ? setConfirmingNone(true) : savePick("none"))}
                className={`button-secondary px-4 py-2 text-base ${pick === "none"  ? "border-[color:var(--text-accent)]" : ""}`}
              >
                Sem foto
              </button>
              {pick === undefined && (
                <span className="text-sm muted">escolha uma arte para liberar a aprovação</span>
              )}
            </>
          )}
        </div>

        {error && <p className="mt-3 text-base text-[#A23A3F]">{error}</p>}

        {showReject && (
          <div className="mt-4 max-w-2xl">
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Motivo da rejeição (vai para review_notes)"
              className="field w-full p-3 text-base"
              rows={3}
            />
            <p className="mt-2 text-sm muted">
              Rejeitar apaga todas as mídias e é terminal. O .md fica em rejeitado/ para a anti-repetição.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => transition("reject")}
              className="button-danger mt-3 px-4 py-2 text-base"
            >
              Confirmar rejeição
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
