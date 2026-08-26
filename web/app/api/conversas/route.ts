import { z } from "zod";
import { radarStore } from "@/lib/store";
import { rota } from "@/lib/rota";

const Body = z.object({ titulo: z.string().min(1).max(120) });

/** As conversas deste ambiente, da mais recente para a mais antiga. */
export const GET = rota(async () => {
  const store = await radarStore();
  return Response.json({ conversas: await store.listarConversas() });
});

export const POST = rota(async (request: Request) => {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "corpo inválido: esperado { titulo }" },
      { status: 400 },
    );
  }
  const store = await radarStore();
  return Response.json(await store.criarConversa(parsed.data.titulo), {
    status: 201,
  });
});
