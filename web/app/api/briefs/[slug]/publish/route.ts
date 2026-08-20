import path from "node:path";
import { z } from "zod";
import { radarStore } from "@/lib/store";
import { rota } from "@/lib/rota";

const Body = z.object({
  igPostUrl: z.string().url(),
  publicadoEm: z.string().datetime({ offset: true }),
});

/**
 * Closes the cycle: the post went live on Instagram.
 *
 * Publishing itself stays manual and outside the product. What the app owns is
 * the record that it happened — which is why the URL is required and not a
 * nicety: it is the proof, and what the archive links to afterwards.
 */
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
      return Response.json(
        { error: "corpo inválido: esperado { igPostUrl, publicadoEm }" },
        { status: 400 },
      );
    }

    const publicadoEm = new Date(parsed.data.publicadoEm);
    // The client validates these too, but the client is not the boundary: a
    // future date or one before approval would corrupt both the archive order
    // and the anti-repetition windows.
    if (publicadoEm > new Date()) {
      return Response.json(
        { error: "data de publicação no futuro", code: "published_at_future" },
        { status: 422 },
      );
    }

    const store = await radarStore();
    await store.marcarPublicado(slug, {
      igPostUrl: parsed.data.igPostUrl,
      publicadoEm,
    });

    return Response.json({ slug, estado: "publicado" });
  },
);
