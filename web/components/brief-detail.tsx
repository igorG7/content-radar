"use client";

import { useEffect, useRef } from "react";
import { BriefDetailContent } from "./brief-detail-content";
import type { QueueBrief } from "./queue-types";

export function BriefDetail({ brief, onClose }: { brief: QueueBrief; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  // Native <dialog> brings Esc, focus trapping and the backdrop for free.
  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) ref.current?.close();
      }}
      className="m-auto w-[min(52rem,92vw)] rounded-lg bg-[color:var(--surface)] p-0 text-[var(--text-strong)] shadow-2xl backdrop:bg-black/55"
    >
      <div className="max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[color:var(--line)] bg-[color:var(--surface-alpha)] p-5 backdrop-blur">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm muted">
              <span className="font-mono">{brief.briefId}</span>
              {brief.pillar && <span>{brief.pillar}</span>}
              {brief.icp && <span>{brief.icp}</span>}
              {brief.scope && <span>escopo {brief.scope}</span>}
              {brief.borderline && <span className="pill pill-warning px-2 py-1">borderline</span>}
            </div>
            <h2 className="mt-2 text-2xl font-semibold leading-snug">{brief.headline ?? brief.slug}</h2>
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="fechar"
            className="button-secondary shrink-0 px-2.5 py-1 text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-5">
          <BriefDetailContent brief={brief} />
        </div>
      </div>
    </dialog>
  );
}
