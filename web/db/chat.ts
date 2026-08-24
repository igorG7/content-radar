import "server-only";

/**
 * O agente do chat: conversa sobre o ambiente e dispara varredura.
 *
 * Diferente do executor em tudo o que importa. O executor é longo, roda
 * destacado e materializa um workspace; este é curto, interativo e **não toca
 * em arquivo nenhum** — o contexto dele vem de ferramentas que leem o banco.
 * É a injeção por ferramenta que o desenho adiou para o segundo cliente
 * (design-migracao §5.4), antecipada aqui porque conversar sem ela seria
 * materializar um diretório inteiro para responder "quais escopos existem?".
 *
 * Pedir varredura daqui **enfileira**, não executa: quem executa é o
 * trabalhador, porque a execução leva de 12 a 63 minutos e nenhuma conversa
 * espera isso.
 */

import {
  createSdkMcpServer,
  query,
  tool,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { FERRAMENTAS } from "../lib/chat/ferramentas";
import type { RadarStore } from "../lib/store";
import { linhasDeConsumo } from "../lib/telemetria";

export interface Turno {
  papel: "usuario" | "agente";
  texto: string;
}

export type EventoChat =
  | { tipo: "texto"; delta: string }
  | { tipo: "ferramenta"; nome: string }
  | { tipo: "resultado"; nome: string; dados: unknown }
  | { tipo: "fim"; sessaoId: string | null }
  | { tipo: "erro"; mensagem: string };

/**
 * Monta o servidor de ferramentas **fechado sobre este store**. O ambiente
 * nunca aparece como argumento: é o que impede a fronteira entre clientes de
 * depender de o modelo se comportar.
 */
function servidorDeFerramentas(store: RadarStore, conversaId?: string) {
  return createSdkMcpServer({
    name: "radar",
    version: "1.0.0",
    tools: FERRAMENTAS.map((f) =>
      tool(
        f.nome,
        f.descricao,
        Object.fromEntries(
          Object.entries(f.parametros).map(([nome, p]) => {
            const base =
              p.tipo === "number"
                ? z.number().describe(p.descricao)
                : z.string().describe(p.descricao);
            return [nome, p.obrigatorio ? base : base.optional()];
          }),
        ),
        async (args) => {
          const dados = await f.executar(
            store,
            args as Record<string, unknown>,
            { conversaId },
          );
          return {
            content: [{ type: "text", text: JSON.stringify(dados, null, 2) }],
          };
        },
      ),
    ),
  });
}

function instrucoes(nomeDoAmbiente: string): string {
  return `Você é o agente editorial do content-radar, conversando com quem aprova
pauta da ${nomeDoAmbiente}.

O que você sabe sobre esta empresa vem das ferramentas, não da sua memória.
Antes de afirmar qualquer coisa — escopo, pilar, público, configuração, fila,
brief, anexo, varredura —, consulte. Não invente slug: se não veio de uma
ferramenta, ele não existe.

Sobre varredura:
- Ela leva de 12 a 63 minutos e roda fora desta conversa. Pedir é enfileirar.
- Confirme escopo e pilar com a pessoa antes de chamar \`pedir_varredura\`. É
  trabalho pago e não dá para cancelar pela metade.
- Se a pessoa já disse escopo e pilar claramente, não fique repetindo a
  pergunta — confirme uma vez e execute.
- Depois de enfileirar, diga a referência e como acompanhar.
- **Estado de varredura você nunca lembra: você consulta.** Ela termina
  enquanto a conversa segue aberta, então o que era verdade há dez minutos
  provavelmente não é mais. Antes de dizer que algo "segue rodando", chame
  \`varredura_atual\` — já aconteceu de afirmar que uma varredura corria uma
  hora depois de ela ter terminado com duas pautas prontas.
- Se ninguém perguntou pelo estado, não o ofereça. Lembrete não solicitado sobre
  varredura é onde a memória velha escapa como se fosse fato.

Você não aprova, não publica e não rejeita brief. Essas decisões são da pessoa,
e têm botão próprio na interface — se pedirem, diga onde fica.

Responda em português do Brasil, direto, sem preâmbulo.`;
}

/**
 * Roda um turno de conversa, transmitindo o que acontece.
 *
 * @param sessaoAnterior id devolvido por um turno anterior. É o que faz a
 * conversa ter memória sem o app reenviar o histórico inteiro a cada mensagem.
 */
export async function* conversar(
  store: RadarStore,
  nomeDoAmbiente: string,
  mensagem: string,
  sessaoAnterior?: string,
  conversaId?: string,
): AsyncGenerator<EventoChat> {
  const servidor = servidorDeFerramentas(store, conversaId);
  const permitidas = FERRAMENTAS.map((f) => `mcp__radar__${f.nome}`);

  let sessaoId: string | null = sessaoAnterior ?? null;
  let ultimoUso: Parameters<typeof linhasDeConsumo>[0];

  try {
    const execucao = query({
      prompt: mensagem,
      options: {
        systemPrompt: instrucoes(nomeDoAmbiente),
        mcpServers: { radar: servidor },
        // Só as ferramentas do radar: sem Read, Bash ou Write. O agente do chat
        // não tem por que tocar no sistema de arquivos do servidor — e não
        // listar aqui é o que garante isso, não a boa vontade do modelo.
        allowedTools: permitidas,
        // As ferramentas já são a única superfície; nada aqui precisa de
        // aprovação humana por chamada, senão a conversa trava a cada consulta.
        permissionMode: "bypassPermissions",
        ...(sessaoAnterior ? { resume: sessaoAnterior } : {}),
      },
    });

    for await (const msg of execucao) {
      if (msg.type === "system" && "session_id" in msg) {
        sessaoId = String(msg.session_id);
      }

      if (msg.type === "assistant") {
        for (const bloco of msg.message.content) {
          if (bloco.type === "text") {
            yield { tipo: "texto", delta: bloco.text };
          }
          if (bloco.type === "tool_use") {
            // A pessoa vê o que foi consultado. Ferramenta invisível faz a
            // resposta parecer adivinhação.
            yield {
              tipo: "ferramenta",
              nome: String(bloco.name).replace("mcp__radar__", ""),
            };
          }
        }
      }

      // Cumulativo: o último resultado substitui, não soma. Ver telemetria.ts.
      if (msg.type === "result") {
        ultimoUso =
          (msg as { modelUsage?: Parameters<typeof linhasDeConsumo>[0] })
            .modelUsage ?? ultimoUso;
      }
      if (msg.type === "result" && msg.subtype !== "success") {
        yield { tipo: "erro", mensagem: `execução terminou em ${msg.subtype}` };
        return;
      }
    }

    yield { tipo: "fim", sessaoId };
  } catch (erro) {
    yield { tipo: "erro", mensagem: (erro as Error).message };
  } finally {
    /**
     * No `finally` para medir também o turno que falhou ou que o usuário
     * interrompeu — os dois já gastaram. Erro engolido: perder a medição é
     * melhor que derrubar a conversa por causa dela.
     */
    try {
      const linhas = linhasDeConsumo(ultimoUso);
      if (linhas.length > 0) {
        await store.registrarConsumo({ origem: "chat", conversaId, linhas });
      }
    } catch (falha) {
      console.warn(
        `[chat] não consegui registrar consumo: ${(falha as Error).message}`,
      );
    }
  }
}
