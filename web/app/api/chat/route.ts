import { z } from "zod";
import { radarStore } from "@/lib/store";
import { rota } from "@/lib/rota";
import { conversar } from "@/db/chat";
import { sessaoAtual } from "@/lib/sessao";

const Body = z.object({
  mensagem: z.string().min(1).max(8000),
  /** A conversa a que este turno pertence. */
  conversaId: z.string().uuid(),
  modelo: z.string().max(60).optional(),
  esforco: z.string().max(30).optional(),
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
      { error: "corpo inválido: esperado { mensagem, conversaId }" },
      { status: 400 },
    );
  }

  const store = await radarStore();
  const sessao = await sessaoAtual();

  /**
   * A sessão do agente vem do banco, não do navegador.
   *
   * Enquanto o cliente a carregava, um F5 apagava a memória da conversa junto
   * com o ponteiro. Lê-la aqui também impede que alguém continue a sessão de
   * outra conversa passando um id qualquer.
   */
  const { sessaoAgente } = await store.buscarConversa(parsed.data.conversaId);

  await store.gravarMensagem(parsed.data.conversaId, {
    papel: "usuario",
    corpo: parsed.data.mensagem,
  });

  const fluxo = new ReadableStream({
    async start(controlador) {
      const enc = new TextEncoder();
      const enviar = (dado: unknown) =>
        controlador.enqueue(enc.encode(`data: ${JSON.stringify(dado)}\n\n`));

      /**
       * O que o agente escreveu, acumulado para gravar ao fim do turno. Gravar
       * a cada delta faria uma linha por fragmento; gravar só no fim significa
       * que uma queda no meio perde a resposta parcial — e resposta pela metade
       * no histórico é pior que ausência, porque parece completa.
       */
      let texto = "";
      const ferramentas: string[] = [];

      try {
        for await (const evento of conversar(
          store,
          sessao?.ambienteNome ?? "empresa",
          parsed.data.mensagem,
          sessaoAgente ?? undefined,
          parsed.data.conversaId,
        )) {
          if (evento.tipo === "texto") texto += evento.delta;
          if (evento.tipo === "ferramenta") ferramentas.push(evento.nome);
          if (evento.tipo === "fim" || evento.tipo === "erro") {
            await store.gravarMensagem(parsed.data.conversaId, {
              papel: evento.tipo === "erro" ? "erro" : "agente",
              corpo: evento.tipo === "erro" ? evento.mensagem : texto,
              ferramentas,
              modelo: parsed.data.modelo,
              esforco: parsed.data.esforco,
              ...(evento.tipo === "fim" && evento.sessaoId
                ? { sessaoAgente: evento.sessaoId }
                : {}),
            });
          }
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
