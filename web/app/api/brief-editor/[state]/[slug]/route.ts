import path from "node:path";
import { z } from "zod";
import { radarStore, type EdicaoBrief } from "@/lib/store";
import { rota } from "@/lib/rota";

const EditableState = z.enum(["pendente-aprovacao", "pendente-publicacao"]);

const Body = z.object({
  headline: z.string().max(240).optional(),
  hook: z.string().max(1200).optional(),
  captionDraft: z.string().max(8000).optional(),
  hashtags: z.array(z.string().max(80)).max(40).optional(),
  cta: z.string().max(1200).optional(),
  suggestedSlot: z.string().max(120).optional(),
  format: z.string().max(120).optional(),
  reviewNotes: z.string().max(8000).optional(),
  visualBrief: z
    .object({
      baseTemplate: z.string().max(240).optional(),
      compositionNotes: z.string().max(8000).optional(),
      mustHave: z.array(z.string().max(300)).max(50),
      avoidVisual: z.array(z.string().max(300)).max(50),
      aspectRatio: z.string().max(80).optional(),
    })
    .optional(),
});

function cleanString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export const PATCH = rota(
  async (
    request: Request,
    { params }: { params: Promise<{ state: string; slug: string }> },
  ) => {
    const { state, slug } = await params;
    if (slug !== path.basename(slug)) {
      return Response.json({ error: "slug inválido" }, { status: 400 });
    }

    const parsedState = EditableState.safeParse(state);
    if (!parsedState.success) {
      return Response.json({ error: "estado não editável" }, { status: 422 });
    }

    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json(
        { error: "corpo inválido", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const input = parsed.data;
    const patches: EdicaoBrief = {
      headline: cleanString(input.headline) ?? null,
      hook: cleanString(input.hook) ?? null,
      caption_draft: cleanString(input.captionDraft) ?? null,
      hashtags: input.hashtags ?? [],
      cta: cleanString(input.cta) ?? null,
      suggested_slot: cleanString(input.suggestedSlot) ?? null,
      format: cleanString(input.format) ?? null,
      review_notes: cleanString(input.reviewNotes) ?? null,
    };

    if (input.visualBrief) {
      patches.visual_brief = {
        base_template: cleanString(input.visualBrief.baseTemplate) ?? null,
        composition_notes:
          cleanString(input.visualBrief.compositionNotes) ?? null,
        must_have: input.visualBrief.mustHave,
        avoid_visual: input.visualBrief.avoidVisual,
        aspect_ratio: cleanString(input.visualBrief.aspectRatio) ?? null,
      };
    }

    const store = await radarStore();
    await store.editarBrief(parsedState.data, slug, patches);

    return Response.json({ slug, state: parsedState.data });
  },
);
