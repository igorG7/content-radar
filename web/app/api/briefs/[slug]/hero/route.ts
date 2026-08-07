import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { loadManifest, resolvePaths } from "@/lib/manifest";
import { patchScalars, readFileWithFrontmatter } from "@/lib/store/frontmatter";

const Body = z.object({ heroChoice: z.number().int().nonnegative().nullable() });

/**
 * Records the human's hero pick. Kept separate from the transition so the
 * choice is persisted the moment it is made, and approve stays a pure move.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (slug !== path.basename(slug)) {
    return Response.json({ error: "slug inválido" }, { status: 400 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "corpo inválido: esperado { heroChoice: number | null }" }, { status: 400 });
  }
  const { heroChoice } = parsed.data;

  const paths = resolvePaths(await loadManifest());
  const filePath = path.join(paths.briefsDir["pendente-aprovacao"], `${slug}.md`);

  let data: Record<string, unknown>;
  try {
    ({ data } = await readFileWithFrontmatter(filePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return Response.json({ error: "brief não está em pendente-aprovacao" }, { status: 404 });
    }
    throw error;
  }

  if (heroChoice !== null) {
    const candidates = Array.isArray(data.hero_image_candidates)
      ? (data.hero_image_candidates as { index?: unknown }[])
      : [];
    if (!candidates.some((candidate) => candidate?.index === heroChoice)) {
      return Response.json(
        { error: `não existe candidata com índice ${heroChoice}` },
        { status: 422 },
      );
    }
  }

  const raw = await readFile(filePath, "utf8");
  await writeFile(filePath, patchScalars(raw, { hero_choice: heroChoice }), "utf8");

  return Response.json({ slug, heroChoice });
}
