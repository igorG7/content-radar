import path from "node:path";
import { radarStore } from "@/lib/store";
import { rota } from "@/lib/rota";

/**
 * The handoff package, as a single `.md` the person downloads and takes to the
 * Smart Design.
 *
 * It used to be a directory of five files written to disk. Four of them were
 * text and fit in one document; the fifth was the hero photo, which after the
 * Cloudinary upload is a URL, not a file. Nothing here is written to the user's
 * disk by us — the download is the delivery.
 */
export const GET = rota(
  async (
    _request: Request,
    { params }: { params: Promise<{ slug: string }> },
  ) => {
    const { slug } = await params;
    if (slug !== path.basename(slug)) {
      return Response.json({ error: "slug inválido" }, { status: 400 });
    }

    const store = await radarStore();
    const { nome, conteudo } = await store.exportar(slug);
    return new Response(conteudo, {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="${nome}"`,
      },
    });
  },
);
