import "server-only";

import { query } from "@anthropic-ai/claude-agent-sdk";
import { materializar, descartar } from "./workspace";
import { linhasDeConsumo } from "../lib/telemetria";
import type { PedidoDeScan } from "../lib/store";

/**
 * A varredura em modo plano — o `--dry-run` da skill, trazido para a conversa.
 *
 * A skill trata `--dry-run` como sagrado: não invoca subagente, não escreve em
 * `store/`, não toca no ledger. Só relata o que faria. É a resposta para "vale
 * gastar?" antes de gastar — a última varredura custou US$ 7,24 por duas pautas.
 *
 * Roda **fora da fila**, de propósito, e sem criar linha de `scan`. Duas razões,
 * e a segunda é a que decide: ele não ocupa vaga, e o banco só admite uma
 * varredura rodando por ambiente — tratá-lo como varredura o bloquearia
 * exatamente quando serve, que é enquanto outra está em curso.
 *
 * Em troca, ele não aparece no histórico: é pergunta, não trabalho.
 */

export interface Ensaio {
  plano: string;
  /** O ensaio também custa, e menos que a varredura é diferente de nada. */
  custoUsd: number;
}

function prompt(pedido: PedidoDeScan): string {
  const args = [`--scope=${pedido.escopo}`, "--dry-run"];
  if (pedido.pilar) args.push(`--pillar=${pedido.pilar}`);
  if (pedido.alvo) args.push(`--target-count=${pedido.alvo}`);

  return `Use a skill radar-scan com ${args.join(" ")}.

É dry-run: não invoque subagente, não escreva em ./store/, não toque no ledger.
Relate o plano — fontes que seriam consultadas, pilar e público-alvo, quantos
briefs a anti-repetição compararia, e o que faria você abortar.

Tudo é relativo ao diretório de trabalho: leia ./manifest.yaml e os arquivos de
target_company.always_load. Não use caminho absoluto — este workspace é de um
ambiente só.`;
}

export async function simular(
  ambienteId: string,
  pedido: PedidoDeScan,
): Promise<Ensaio> {
  const ws = await materializar(ambienteId);

  try {
    const execucao = query({
      prompt: prompt(pedido),
      options: {
        cwd: ws.dir,
        settingSources: ["project"],
        skills: ["radar-scan"],
        /**
         * Só leitura. O modo plano não deveria escrever nada, e a lista é o que
         * garante isso mesmo se a skill se enganar — instrução se ignora, e
         * permissão não. `Task` fica de fora porque subagente é justamente o
         * que o dry-run existe para não gastar.
         */
        permissionMode: "default",
        allowedTools: ["Read", "Glob", "Grep"],
      },
    });

    let plano = "";
    let ultimoUso: Parameters<typeof linhasDeConsumo>[0];

    for await (const msg of execucao) {
      if (msg.type === "assistant" && Array.isArray(msg.message.content)) {
        for (const bloco of msg.message.content) {
          if (bloco.type === "text") plano = bloco.text;
        }
      }
      if (msg.type === "result") {
        ultimoUso =
          (msg as { modelUsage?: Parameters<typeof linhasDeConsumo>[0] })
            .modelUsage ?? ultimoUso;
      }
    }

    const custoUsd = linhasDeConsumo(ultimoUso).reduce(
      (n, l) => n + Number(l.custoUsd),
      0,
    );

    return { plano: plano.trim(), custoUsd };
  } finally {
    // O workspace do ensaio não guarda nada: nada foi escrito nele.
    await descartar(ws);
  }
}
