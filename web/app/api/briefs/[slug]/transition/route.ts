import path from "node:path";
import { z } from "zod";
import { radarStore, TransitionError } from "@/lib/store";
import { rota } from "@/lib/rota";

const Body = z.object({
  direction: z.enum(["approve", "reject"]),
  reason: z.string().max(2000).optional(),
  dryRun: z.boolean().optional(),
});

export const POST = rota(
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
      return Response.json({ error: "corpo inválido" }, { status: 400 });
    }

    const { direction, reason, dryRun } = parsed.data;
    const store = await radarStore();
    const entrada = { slug, direcao: direction, motivo: reason };

    try {
      const result = dryRun
        ? {
            ...(await store.planejarTransicao(entrada)),
            applied: false,
            ledgerEvent: null,
          }
        : await store.aplicarTransicao(entrada);
      return Response.json(result);
    } catch (error) {
      if (error instanceof TransitionError) {
        // These are refusals by the skill's hard rules, not server faults.
        const status = error.code === "not_found" ? 404 : 422;
        return Response.json(
          { error: error.message, code: error.code },
          { status },
        );
      }
      throw error;
    }
  },
);
