import { z } from "zod";
import { radarStore } from "@/lib/store";
import { rota } from "@/lib/rota";

const Body = z.object({ titulo: z.string().min(1).max(120) });

/** Uma conversa com o histórico — é o que a tela carrega ao abrir. */
export const GET = rota(
  async (
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const store = await radarStore();
    return Response.json(await store.buscarConversa((await params).id));
  },
);

export const PATCH = rota(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json(
        { error: "corpo inválido: esperado { titulo }" },
        { status: 400 },
      );
    }
    const store = await radarStore();
    await store.renomearConversa((await params).id, parsed.data.titulo);
    return Response.json({ ok: true });
  },
);

export const DELETE = rota(
  async (
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const store = await radarStore();
    await store.excluirConversa((await params).id);
    return Response.json({ ok: true });
  },
);
