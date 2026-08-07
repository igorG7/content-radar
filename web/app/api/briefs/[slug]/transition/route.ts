import path from "node:path";
import { z } from "zod";
import { loadManifest, resolvePaths } from "@/lib/manifest";
import { runTransition, TransitionError } from "@/lib/transitions/mv";

const Body = z.object({
  direction: z.enum(["approve", "reject"]),
  reason: z.string().max(2000).optional(),
  dryRun: z.boolean().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (slug !== path.basename(slug)) {
    return Response.json({ error: "slug inválido" }, { status: 400 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "corpo inválido" }, { status: 400 });
  }

  const paths = resolvePaths(await loadManifest());

  try {
    const result = await runTransition({ slug, ...parsed.data }, paths);
    return Response.json(result);
  } catch (error) {
    if (error instanceof TransitionError) {
      // These are refusals by the skill's hard rules, not server faults.
      const status = error.code === "not_found" ? 404 : 422;
      return Response.json({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }
}
