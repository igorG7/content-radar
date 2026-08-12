import path from "node:path";
import { z } from "zod";
import { loadManifest, resolvePaths } from "@/lib/manifest";
import { readFileWithFrontmatter, replaceFrontmatterFields } from "@/lib/store/frontmatter";

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
  visualBrief: z.object({
    baseTemplate: z.string().max(240).optional(),
    compositionNotes: z.string().max(8000).optional(),
    mustHave: z.array(z.string().max(300)).max(50),
    avoidVisual: z.array(z.string().max(300)).max(50),
    aspectRatio: z.string().max(80).optional(),
  }).optional(),
});

function cleanString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ state: string; slug: string }> },
) {
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
    return Response.json({ error: "corpo inválido", details: parsed.error.flatten() }, { status: 400 });
  }

  const paths = resolvePaths(await loadManifest());
  const filePath = path.join(paths.briefsDir[parsedState.data], `${slug}.md`);

  try {
    await readFileWithFrontmatter(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return Response.json({ error: "brief não encontrado neste estado" }, { status: 404 });
    }
    throw error;
  }

  const input = parsed.data;
  const patches: Record<string, unknown> = {
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
      composition_notes: cleanString(input.visualBrief.compositionNotes) ?? null,
      must_have: input.visualBrief.mustHave,
      avoid_visual: input.visualBrief.avoidVisual,
      aspect_ratio: cleanString(input.visualBrief.aspectRatio) ?? null,
    };
  }

  await replaceFrontmatterFields(filePath, patches);
  return Response.json({ slug, state: parsedState.data });
}
