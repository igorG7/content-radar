import { z } from "zod";
import { radarStore } from "@/lib/store";
import { rota } from "@/lib/rota";
import { conversar } from "@/db/chat";
import { sessaoAtual } from "@/lib/sessao";

const Body = z.object({
  mensagem: z.string().min(1).max(8000),
  /** Devolvido pelo turno anterior. É o que dá memória à conversa. */
  sessaoAgente: z.string().max(200).optional(),
});

/**
 * Um turno de conversa, transmitido conforme acontece.
 *
 * SSE e não JSON de uma vez: o agente consulta ferramentas antes de responder,
 * e uma resposta que aparece inteira depois de vários segundos parece travada.
 * Ver os nomes das consultas passando é o que mostra que a resposta foi
 * apurada, não adivinhada.
 */
export const POST = rota(async (request: Request) => {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "corpo inválido: esperado { mensagem, sessaoAgente? }" },
      { status: 400 },
    );
  }

  const store = await radarStore();
  const sessao = await sessaoAtual();

  const fluxo = new ReadableStream({
    async start(controlador) {
      const enc = new TextEncoder();
      const enviar = (dado: unknown) =>
        controlador.enqueue(enc.encode(`data: ${JSON.stringify(dado)}\n\n`));

      try {
        for await (const evento of conversar(
          store,
          sessao?.ambienteNome ?? "empresa",
          parsed.data.mensagem,
          parsed.data.sessaoAgente,
        )) {
          enviar(evento);
        }
      } catch (erro) {
        // O fluxo já começou: não há como devolver status agora, então o erro
        // vai como evento. Fechar calado deixaria a tela girando para sempre.
        enviar({ tipo: "erro", mensagem: (erro as Error).message });
      } finally {
        controlador.close();
      }
    },
  });

  return new Response(fluxo, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
});
