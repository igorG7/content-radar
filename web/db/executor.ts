import "server-only";

/**
 * Executa um scan: materializa o workspace, roda o agente contra ele, registra
 * o progresso e ingere o resultado.
 *
 * Roda **fora do processo que atende HTTP**. Não é preferência de arquitetura:
 * os 20 scans registrados levaram de 12 a 63 minutos, e nenhum ciclo de
 * requisição sobrevive a isso — nem a aba do navegador precisa ficar aberta.
 *
 * O diretório de trabalho é o workspace do ambiente. É de lá que o SDK carrega
 * as skills e os subagentes, e é de lá que eles leem manifest, vault e briefs.
 * Com `settingSources: ["project"]`, nada do repositório vaza para dentro.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { eq } from "drizzle-orm";
import { comAmbiente } from "./cliente";
import * as t from "./schema";
import { materializar, descartar, type Workspace } from "./workspace";
import { ingerir, type RelatorioIngestao } from "./ingerir";

export type Estagio = "pesquisa" | "filtragem" | "redacao";

/**
 * O estágio é inferido de qual subagente está rodando — sinal real, não
 * suposição. O `radar-scan` invoca os três em ordem, e cada um marca uma etapa
 * do pipeline (spec 005 §5).
 */
const ESTAGIO_DO_AGENTE: Record<string, Estagio> = {
  "market-researcher": "pesquisa",
  "avanz-matcher": "filtragem",
  "instagram-briefer": "redacao",
};

export interface PedidoDeScan {
  escopo: string;
  pilar?: string;
  alvo?: number;
}

export interface ResultadoScan {
  scanId: string;
  scanRef: string;
  /** Onde o workspace ficou. Já descartado — serve para diagnóstico e teste. */
  workspace?: string;
  estado: "concluido" | "falhou";
  minutos: number;
  estagios: { estagio: Estagio; minuto: number }[];
  ingestao?: RelatorioIngestao;
  erro?: string;
}

/** Um scan simultâneo por ambiente — justiça entre clientes (§4 do desenho). */
export class JaRodando extends Error {
  constructor() {
    super("já existe um scan rodando neste ambiente");
    this.name = "JaRodando";
  }
}

function refDeScan(agora: Date, sequencia: number): string {
  const ano = agora.getUTCFullYear();
  const inicio = Date.UTC(ano, 0, 1);
  const semana = Math.ceil(((agora.getTime() - inicio) / 86400000 + 1) / 7);
  return `${ano}-W${String(semana).padStart(2, "0")}-scan-${String(sequencia).padStart(3, "0")}`;
}

function prompt(pedido: PedidoDeScan): string {
  const args = [`--scope=${pedido.escopo}`];
  if (pedido.pilar) args.push(`--pillar=${pedido.pilar}`);
  if (pedido.alvo) args.push(`--target-count=${pedido.alvo}`);
  return `Use a skill radar-scan com ${args.join(" ")}.

Tudo é relativo ao diretório de trabalho: leia ./manifest.yaml, os arquivos de
target_company.always_load, e escreva em ./store/. Não use caminho absoluto para
manifest, vault ou store — este workspace é de um ambiente só.`;
}

/**
 * @param jaEnfileirado id de um `scan` que já existe em `enfileirado`. A fila
 * passa o dela para a identidade sobreviver de ponta a ponta: a tela acompanha
 * o scan pelo id desde o momento em que foi pedido, e criar outro aqui deixaria
 * o evento de enfileiramento apontando para uma linha que sumiu.
 */
export async function executar(
  ambienteId: string,
  pedido: PedidoDeScan,
  jaEnfileirado?: string,
): Promise<ResultadoScan> {
  let ws: Workspace | undefined;
  const inicio = Date.now();
  const estagios: { estagio: Estagio; minuto: number }[] = [];
  const minuto = () => Math.round(((Date.now() - inicio) / 60000) * 10) / 10;

  /**
   * A vaga é garantida pelo banco, não pela aplicação: um índice único parcial
   * sobre `(ambiente_id) where estado = 'rodando'` (migração 0004).
   *
   * A checagem aqui existe só para dar mensagem boa no caso comum. Ela não é a
   * garantia — se fosse, o limite dependeria de todo caminho de código lembrar
   * de checar, e um teste de concorrência passaria por acaso quando as chamadas
   * serializassem sozinhas. Quem recusa de verdade é a violação do índice.
   */
  const { scanId, scanRef } = await comAmbiente(ambienteId, async (tx) => {
    if (jaEnfileirado) {
      const [linha] = await tx
        .update(t.scan)
        .set({ estado: "rodando", iniciadoEm: new Date() })
        .where(eq(t.scan.id, jaEnfileirado))
        .returning({ id: t.scan.id, ref: t.scan.scanRef });
      if (!linha)
        throw new Error(`scan enfileirado não existe: ${jaEnfileirado}`);
      return { scanId: linha.id, scanRef: linha.ref };
    }

    const rodando = await tx
      .select({ id: t.scan.id })
      .from(t.scan)
      .where(eq(t.scan.estado, "rodando"));
    if (rodando.length > 0) throw new JaRodando();

    const todos = await tx.select({ id: t.scan.id }).from(t.scan);
    const ref = refDeScan(new Date(), todos.length + 1);

    try {
      const [linha] = await tx
        .insert(t.scan)
        .values({
          ambienteId,
          scanRef: ref,
          escopo: pedido.escopo,
          pilarFiltro: pedido.pilar ?? null,
          alvoQtd: pedido.alvo ?? null,
          estado: "rodando",
        })
        .returning({ id: t.scan.id });

      return { scanId: linha.id, scanRef: ref };
    } catch (erro) {
      const causa = (erro as { cause?: unknown }).cause ?? erro;
      if (
        /scan_um_rodando_por_ambiente/.test(String((causa as Error).message))
      ) {
        throw new JaRodando();
      }
      throw erro;
    }
  });

  /**
   * Cada transição vira evento no ledger, com a contagem parcial daquele
   * estágio. É dado que só existe durante a execução e some se ninguém gravar —
   * e é o que teria respondido de onde vieram os 63 minutos do pior scan
   * (design-execucao-scan §8.2).
   */
  async function marcarEstagio(
    estagio: Estagio,
    extra: Record<string, unknown> = {},
  ) {
    estagios.push({ estagio, minuto: minuto() });
    await comAmbiente(ambienteId, async (tx) => {
      await tx
        .update(t.scan)
        .set({ estado: estagio })
        .where(eq(t.scan.id, scanId));
      await tx.insert(t.evento).values({
        ambienteId,
        tipo: "scan-stage",
        ator: "app:radar-executor",
        scanId,
        extra: { estagio, minuto: minuto(), ...extra },
      });
    });
  }

  try {
    ws = await materializar(ambienteId);

    await comAmbiente(ambienteId, async (tx) => {
      await tx.insert(t.evento).values({
        ambienteId,
        tipo: "scan-started",
        ator: "app:radar-executor",
        scanId,
        extra: {
          scope: pedido.escopo,
          pillar_filter: pedido.pilar ?? null,
          target_count: pedido.alvo ?? null,
        },
      });
    });

    const execucao = query({
      prompt: prompt(pedido),
      options: {
        cwd: ws.dir,
        // Só o projeto: o workspace é a raiz, e nada das configurações do
        // usuário ou da máquina entra na execução de um cliente.
        settingSources: ["project"],
        skills: ["radar-scan"],
        // O scan escreve brief e mídia no próprio workspace. Sem isto, cada
        // escrita viraria uma pergunta que ninguém está lá para responder.
        permissionMode: "acceptEdits",
      },
    });

    let vistos = 0;
    for await (const msg of execucao) {
      vistos++;
      // O estágio se lê da invocação do subagente: é o pipeline dizendo onde
      // está, em vez de o executor adivinhar por tempo decorrido.
      if (msg.type === "assistant") {
        for (const bloco of msg.message.content) {
          if (bloco.type !== "tool_use" || bloco.name !== "Task") continue;
          const alvo = String(
            (bloco.input as { subagent_type?: string }).subagent_type ?? "",
          );
          const estagio = ESTAGIO_DO_AGENTE[alvo];
          if (estagio && estagios.at(-1)?.estagio !== estagio) {
            await marcarEstagio(estagio);
          }
        }
      }
      if (msg.type === "result" && msg.subtype !== "success") {
        throw new Error(`execução terminou em ${msg.subtype}`);
      }
    }

    const ingestao = await ingerir(ws);

    await comAmbiente(ambienteId, async (tx) => {
      await tx
        .update(t.scan)
        .set({ estado: "concluido", encerradoEm: new Date() })
        .where(eq(t.scan.id, scanId));
      await tx.insert(t.evento).values({
        ambienteId,
        tipo: "scan-finished",
        ator: "app:radar-executor",
        scanId,
        extra: { minutos: minuto(), mensagens: vistos, ...ingestao },
      });
    });

    return {
      scanId,
      scanRef,
      estado: "concluido",
      minutos: minuto(),
      estagios,
      ingestao,
      workspace: ws.dir,
    };
  } catch (erro) {
    const mensagem = (erro as Error).message;

    await comAmbiente(ambienteId, async (tx) => {
      await tx
        .update(t.scan)
        .set({ estado: "falhou", encerradoEm: new Date() })
        .where(eq(t.scan.id, scanId));
      await tx.insert(t.evento).values({
        ambienteId,
        tipo: "scan-aborted",
        ator: "app:radar-executor",
        scanId,
        // O estágio em que parou é metade do diagnóstico: falhar na pesquisa de
        // 10 fontes é problema diferente de falhar na redação.
        extra: {
          erro: mensagem,
          estagio: estagios.at(-1)?.estagio ?? "nenhum",
          minutos: minuto(),
        },
      });
    });

    return {
      scanId,
      scanRef,
      estado: "falhou",
      minutos: minuto(),
      estagios,
      erro: mensagem,
      workspace: ws?.dir,
    };
  } finally {
    // O workspace some sempre: ele é derivado do banco e regenerá-lo custa
    // segundos. Guardar o de uma falha só acumularia lixo em /tmp.
    if (ws) await descartar(ws);
  }
}
