import { z } from "zod";
import { JaRodando, radarStore } from "@/lib/store";
import { rota } from "@/lib/rota";

const Body = z.object({
  escopo: z.string().min(1).max(120),
  pilar: z.string().min(1).max(120).optional(),
  alvo: z.number().int().min(1).max(50).optional(),
});

/**
 * Pede uma varredura. Responde 202, não 200: o trabalho foi aceito, não
 * concluído — a execução leva de 12 a 63 minutos e acontece noutro processo.
 */
export const POST = rota(async (request: Request) => {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "corpo inválido: esperado { escopo, pilar?, alvo? }" },
      { status: 400 },
    );
  }

  const store = await radarStore();

  // O escopo precisa existir na configuração deste ambiente. Sem a checagem, um
  // escopo inventado só falharia lá na frente, dentro da execução, vinte
  // minutos depois e com o custo já pago.
  const escopos = await store.escoposDeBusca();
  const escolhido = escopos.find((e) => e.slug === parsed.data.escopo);
  if (!escolhido) {
    return Response.json(
      {
        error: `escopo desconhecido: ${parsed.data.escopo}`,
        code: "escopo_desconhecido",
        disponiveis: escopos.filter((e) => e.ativo).map((e) => e.slug),
      },
      { status: 422 },
    );
  }
  if (!escolhido.ativo) {
    return Response.json(
      {
        error: `o escopo ${escolhido.label} está desativado na configuração`,
        code: "escopo_inativo",
      },
      { status: 422 },
    );
  }

  try {
    const r = await store.enfileirarScan(parsed.data);
    return Response.json(r, { status: 202 });
  } catch (erro) {
    if (erro instanceof JaRodando) {
      // Explica a recusa em vez de falhar em silêncio (design-execucao-scan §7).
      return Response.json(
        { error: erro.message, code: "ja_rodando" },
        { status: 409 },
      );
    }
    throw erro;
  }
});

/**
 * A varredura mais recente — em voo ou terminada, com o desfecho.
 *
 * Terminada também: antes isto só devolvia a em voo, e o painel voltava a
 * "nenhuma em andamento" no exato instante em que a varredura produzia algo.
 */
export const GET = rota(async () => {
  const store = await radarStore();
  return Response.json({ scan: await store.varreduraRecente() });
});
