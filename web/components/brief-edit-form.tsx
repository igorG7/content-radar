"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { QueueBrief } from "./queue-types";

function linesToArray(value: string): string[] {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function hashtagsToArray(value: string): string[] {
  return value.split(/[\n,]/).map((item) => item.trim().replace(/^#/, "")).filter(Boolean);
}

export function BriefEditForm({
  brief,
  state,
  backHref,
}: {
  brief: QueueBrief;
  state: "pendente-aprovacao" | "pendente-publicacao";
  backHref: string;
}) {
  const router = useRouter();
  const [headline, setHeadline] = useState(brief.headline ?? "");
  const [hook, setHook] = useState(brief.hook ?? "");
  const [captionDraft, setCaptionDraft] = useState(brief.captionDraft ?? "");
  const [hashtags, setHashtags] = useState(brief.hashtags.join(", "));
  const [cta, setCta] = useState(brief.cta ?? "");
  const [suggestedSlot, setSuggestedSlot] = useState(brief.suggestedSlot ?? "");
  const [format, setFormat] = useState(brief.format ?? "");
  const [reviewNotes, setReviewNotes] = useState(brief.reviewNotes ?? "");
  const [baseTemplate, setBaseTemplate] = useState(brief.visualBrief?.baseTemplate ?? "");
  const [aspectRatio, setAspectRatio] = useState(brief.visualBrief?.aspectRatio ?? "");
  const [compositionNotes, setCompositionNotes] = useState(brief.visualBrief?.compositionNotes ?? "");
  const [mustHave, setMustHave] = useState(brief.visualBrief?.mustHave.join("\n") ?? "");
  const [avoidVisual, setAvoidVisual] = useState(brief.visualBrief?.avoidVisual.join("\n") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch(`/api/brief-editor/${state}/${brief.slug}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          headline,
          hook,
          captionDraft,
          hashtags: hashtagsToArray(hashtags),
          cta,
          suggestedSlot,
          format,
          reviewNotes,
          visualBrief: {
            baseTemplate,
            aspectRatio,
            compositionNotes,
            mustHave: linesToArray(mustHave),
            avoidVisual: linesToArray(avoidVisual),
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "falha ao salvar");
      setSaved(true);
      router.refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="panel p-5 sm:p-6">
        <h2 className="mb-4 text-xl font-semibold text-[var(--text-strong)]">Texto principal</h2>
        <div className="space-y-4">
          <label className="block text-base font-semibold">
            Headline
            <input value={headline} onChange={(event) => setHeadline(event.target.value)} className="field mt-2 w-full px-3 py-2 text-base" />
          </label>
          <label className="block text-base font-semibold">
            Hook
            <textarea value={hook} onChange={(event) => setHook(event.target.value)} className="field mt-2 w-full p-3 text-base" rows={3} />
          </label>
          <label className="block text-base font-semibold">
            Rascunho da legenda
            <textarea value={captionDraft} onChange={(event) => setCaptionDraft(event.target.value)} className="field mt-2 w-full p-3 text-base" rows={8} />
          </label>
        </div>
      </section>

      <section className="panel p-5 sm:p-6">
        <h2 className="mb-4 text-xl font-semibold text-[var(--text-strong)]">Distribuição</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-base font-semibold">
            Hashtags
            <textarea value={hashtags} onChange={(event) => setHashtags(event.target.value)} className="field mt-2 w-full p-3 text-base" rows={3} />
          </label>
          <label className="block text-base font-semibold">
            CTA
            <textarea value={cta} onChange={(event) => setCta(event.target.value)} className="field mt-2 w-full p-3 text-base" rows={3} />
          </label>
          <label className="block text-base font-semibold">
            Formato
            <input value={format} onChange={(event) => setFormat(event.target.value)} className="field mt-2 w-full px-3 py-2 text-base" />
          </label>
          <label className="block text-base font-semibold">
            Slot sugerido
            <input value={suggestedSlot} onChange={(event) => setSuggestedSlot(event.target.value)} className="field mt-2 w-full px-3 py-2 text-base" />
          </label>
        </div>
      </section>

      <section className="panel p-5 sm:p-6">
        <h2 className="mb-4 text-xl font-semibold text-[var(--text-strong)]">Briefing visual</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-base font-semibold">
            Template base
            <input value={baseTemplate} onChange={(event) => setBaseTemplate(event.target.value)} className="field mt-2 w-full px-3 py-2 text-base" />
          </label>
          <label className="block text-base font-semibold">
            Proporção
            <input value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value)} className="field mt-2 w-full px-3 py-2 text-base" />
          </label>
          <label className="block text-base font-semibold sm:col-span-2">
            Composição
            <textarea value={compositionNotes} onChange={(event) => setCompositionNotes(event.target.value)} className="field mt-2 w-full p-3 text-base" rows={5} />
          </label>
          <label className="block text-base font-semibold">
            Obrigatório
            <textarea value={mustHave} onChange={(event) => setMustHave(event.target.value)} className="field mt-2 w-full p-3 text-base" rows={5} />
          </label>
          <label className="block text-base font-semibold">
            Evitar
            <textarea value={avoidVisual} onChange={(event) => setAvoidVisual(event.target.value)} className="field mt-2 w-full p-3 text-base" rows={5} />
          </label>
        </div>
      </section>

      <section className="panel p-5 sm:p-6">
        <label className="block text-base font-semibold">
          Notas de revisão
          <textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} className="field mt-2 w-full p-3 text-base" rows={5} />
        </label>
      </section>

      {error && <p className="alert-danger p-3 text-base">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy} onClick={save} className="button-primary px-4 py-2 text-base">
          <svg className="h-4 w-4" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3h12l2 2v16H5z" /><path d="M8 3v6h8V3" /><path d="M8 21v-7h8v7" /><path d="M10 6h4" /></svg><span>Salvar alterações</span>
        </button>
        <button type="button" onClick={() => router.push(backHref)} className="button-secondary px-4 py-2 text-base">
          Voltar
        </button>
        {saved && <span className="font-semibold text-[var(--text-accent)]">salvo</span>}
      </div>
    </div>
  );
}
