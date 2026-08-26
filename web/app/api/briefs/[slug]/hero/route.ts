import path from "node:path";
import { z } from "zod";
import { radarStore } from "@/lib/store";
import { rota } from "@/lib/rota";

const Body = z.object({
  heroChoice: z.number().int().nonnegative().nullable(),
});

/**
 * Records the human's hero pick. Kept separate from the transition so the
 * choice is persisted the moment it is made, and approve stays a pure move.
 */
export const PATCH = rota(
  async (
    request: Request,
    { params }: { params: Promise<{ slug: string }> },
  ) => {
    const { slug } = await params;
    if (slug !== path.basename(slug)) {
      return Response.json({ error: "slug inválido" }, { status: 400 });
    }

    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json(
        { error: "corpo inválido: esperado { heroChoice: number | null }" },
        { status: 400 },
      );
    }
    const { heroChoice } = parsed.data;

    const store = await radarStore();
    await store.gravarEscolhaHero(slug, heroChoice);

    return Response.json({ slug, heroChoice });
  },
);
