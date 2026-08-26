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
import { credencialAnthropic } from "../lib/credencial-anthropic";
import { comAmbiente } from "./cliente";
import * as t from "./schema";
import { materializar, descartar, type Workspace } from "./workspace";
import { ingerir, type RelatorioIngestao } from "./ingerir";
import { JaRodando, type Estagio, type PedidoDeScan } from "../lib/store";
import { linhasDeConsumo } from "../lib/telemetria";

export type { Estagio, PedidoDeScan };
export { JaRodando };

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
  let preservarWorkspace = false;
  const inicio = Date.now();
  const estagios: { estagio: Estagio; minuto: number }[] = [];
  let ultimoUso: Parameters<typeof linhasDeConsumo>[0];
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
  const pedidoAtual = await comAmbiente(ambienteId, async (tx) => {
    if (jaEnfileirado) {
      const [linha] = await tx
        .update(t.scan)
        .set({ estado: "rodando", iniciadoEm: new Date() })
        .where(eq(t.scan.id, jaEnfileirado))
        .returning({ id: t.scan.id, ref: t.scan.scanRef });
      /**
       * O pedido pode ter sumido entre a reivindicação e aqui — o ambiente foi
       * removido e levou o scan em cascata. Não é falha: é trabalho que deixou
       * de existir, e lançar faria o trabalhador recuar 30 segundos por nada.
       */
      if (!linha) return { scanId: null, scanRef: jaEnfileirado };
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
          iniciadoEm: new Date(),
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

  if (pedidoAtual.scanId === null) {
    console.warn(
      `[executor] pedido ${pedidoAtual.scanRef} não existe mais; ignorado`,
    );
    return {
      scanId: jaEnfileirado ?? "",
      scanRef: pedidoAtual.scanRef,
      estado: "falhou",
      minutos: 0,
      estagios: [],
      erro: "o pedido não existe mais — ambiente removido antes da execução",
    };
  }

  const scanId: string = pedidoAtual.scanId;
  const scanRef = pedidoAtual.scanRef;

  /**
   * Passo 0: purgar o cache local expirado, como a spec 005 §60 previa —
   * "piggyback" na varredura, que é o momento em que alguém já espera trabalho
   * acontecendo. Sem agendador próprio: scans são poucos por semana e a purga
   * não tem pressa.
   *
   * Best-effort: falhar aqui não aborta a varredura. Disco cheio é problema;
   * disco cheio **e** nenhuma pauta gerada é dois.
   */
  try {
    const { backendPostgres } = await import("./backend");
    const r = await backendPostgres(ambienteId).purgarMidia();
    if (r.apagados > 0 || r.preservados > 0) {
      console.log(
        `[executor] purga: ${r.apagados} arquivo(s), ${Math.round(r.bytes / 1024)} KB` +
          (r.preservados
            ? ` · ${r.preservados} preservado(s) sem cópia remota`
            : ""),
      );
    }
  } catch (erro) {
    console.warn(`[executor] purga falhou: ${(erro as Error).message}`);
  }

  try {
    /**
     * Antes de montar workspace ou registrar `scan-started`: sem credencial a
     * execução do SDK não estoura, ela termina vazia — e o desfecho fica
     * indistinguível de uma varredura que não achou nada. Vinte e cinco minutos
     * para descobrir, e o registro mentindo.
     *
     * O `throw` aqui cai no mesmo caminho de `scan-aborted` do vault vazio.
     */
    const credencial = credencialAnthropic();
    if (!credencial.ok) throw new Error(credencial.motivo);

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
        /**
         * O que o pipeline pode usar, por lista e não por `bypassPermissions`.
         *
         * A lista é mais estreita e diz no código o que a varredura faz: o
         * researcher busca na web, o briefer baixa imagem por `Bash`, e o
         * orquestrador delega por `Task`. Sem declarar, a primeira busca é
         * recusada por falta de permissão — e como não há ninguém para
         * aprovar, o researcher devolve zero achados e a varredura termina
         * limpa e vazia. Foi o que aconteceu na primeira execução real.
         */
        allowedTools: [
          "Task",
          "WebSearch",
          "WebFetch",
          "Read",
          "Write",
          "Edit",
          "Glob",
          "Grep",
          "Bash",
        ],
      },
    });

    let vistos = 0;
    for await (const msg of execucao) {
      vistos++;
      // O estágio se lê da invocação do subagente: é o pipeline dizendo onde
      // está, em vez de o executor adivinhar por tempo decorrido.
      /**
       * O estágio vem de três sinais, do mais direto ao mais indireto.
       *
       * A primeira execução real provou que o `tool_use` chamado `Task` não
       * chega a este laço: o scan rodou o researcher e o estado foi de
       * `rodando` direto para o fim, sem um único `scan-stage`. O SDK, porém,
       * carimba `subagent_type` na própria mensagem e emite
       * `system/task_progress` com o mesmo campo — sinal de primeira mão, em
       * vez de inferência sobre uma chamada de ferramenta.
       */
      const deQuem =
        (msg.type === "assistant" || msg.type === "user") &&
        "subagent_type" in msg
          ? String(msg.subagent_type ?? "")
          : msg.type === "system" &&
              "subtype" in msg &&
              msg.subtype === "task_progress" &&
              "subagent_type" in msg
            ? String(msg.subagent_type ?? "")
            : msg.type === "assistant"
              ? ((
                  msg.message.content.find(
                    (b) => b.type === "tool_use" && b.name === "Task",
                  ) as { input?: { subagent_type?: string } } | undefined
                )?.input?.subagent_type ?? "")
              : "";

      const estagio = ESTAGIO_DO_AGENTE[deQuem];
      if (estagio && estagios.at(-1)?.estagio !== estagio) {
        await marcarEstagio(estagio);
      }
      /**
       * O consumo chega no resultado, e é **cumulativo**: cada resultado traz o
       * total corrente, não o incremento. Por isso o último substitui o
       * anterior em vez de somar — somar contaria o mesmo gasto várias vezes, e
       * o erro cresceria com a duração, que é justamente quando o número
       * importa.
       *
       * Guardado mesmo quando a execução falha: varredura que quebrou aos 20
       * minutos gastou os 20 minutos, e é esse custo que ninguém enxerga hoje.
       */
      if (msg.type === "result") {
        ultimoUso =
          (msg as { modelUsage?: Parameters<typeof linhasDeConsumo>[0] })
            .modelUsage ?? ultimoUso;
      }
      if (msg.type === "result" && msg.subtype !== "success") {
        throw new Error(`execução terminou em ${msg.subtype}`);
      }
    }

    const ingestao = await ingerir(ws, scanId);

    /**
     * Terminar sem exceção não é o mesmo que dar certo: a skill pode abortar
     * sozinha — sem busca disponível, sem achado, sem pauta — e sair limpa. Se
     * o executor ignorasse isso, o banco diria `concluido` enquanto o ledger
     * dizia abortado, e as duas versões conviveriam.
     */
    const abortada = ingestao.abortadaPelaSkill;
    const estadoFinal = abortada ? "falhou" : "concluido";

    /**
     * Sucesso com brief incompleto é o caso que nenhuma das duas regras
     * anteriores cobria: a execução deu certo, então o workspace era
     * descartado — e com ele a única forma de saber por que a legenda veio
     * vazia. Aconteceu no primeiro scan que produziu pauta.
     */
    if (ingestao.avisos.length > 0) preservarWorkspace = true;

    await comAmbiente(ambienteId, async (tx) => {
      await tx
        .update(t.scan)
        .set({ estado: estadoFinal, encerradoEm: new Date() })
        .where(eq(t.scan.id, scanId));
      await tx.insert(t.evento).values({
        ambienteId,
        tipo: abortada ? "scan-aborted" : "scan-finished",
        ator: "app:radar-executor",
        scanId,
        extra: {
          minutos: minuto(),
          mensagens: vistos,
          ...(abortada ? { erro: abortada.motivo } : {}),
          ...ingestao,
        },
      });
    });

    return {
      scanId,
      scanRef,
      estado: estadoFinal,
      erro: abortada?.motivo,
      minutos: minuto(),
      estagios,
      ingestao,
      workspace: ws.dir,
    };
  } catch (erro) {
    const mensagem = (erro as Error).message;
    /**
     * O ambiente pode ter sumido durante a execução — um cliente removido com
     * scan em curso. Registrar o desfecho passa a ser impossível: a chave
     * estrangeira do evento aponta para uma linha que não existe mais. Isso não
     * é motivo para derrubar o trabalhador, que ainda tem fila para atender.
     */
    const registrar = async (trabalho: () => Promise<void>) => {
      try {
        await trabalho();
      } catch (falha) {
        console.warn(
          `[executor] não consegui registrar o desfecho de ${scanRef}: ${(falha as Error).message}`,
        );
      }
    };
    /**
     * A ingestão anexa as recusas ao erro. Sem lê-las, o ledger guarda só
     * "ingestão recusada" — que diz que algo deu errado e nada sobre o quê.
     * Aconteceu na segunda execução real: a varredura passou 24 minutos,
     * escreveu o brief, foi recusada, e o motivo morreu junto com o workspace.
     */
    const recusas = (erro as { relatorio?: { recusas?: unknown[] } }).relatorio
      ?.recusas;
    if (recusas?.length) preservarWorkspace = true;

    await registrar(async () => {
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
            ...(recusas?.length ? { recusas } : {}),
            estagio: estagios.at(-1)?.estagio ?? "nenhum",
            minutos: minuto(),
            // Onde olhar quando o motivo não bastar. Só existe quando o workspace
            // foi preservado — ver o `finally`.
            ...(ws ? { workspace: ws.dir } : {}),
          },
        });
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
    /**
     * A medição é gravada aconteça o que acontecer — inclusive em falha, que é
     * quando o custo dói mais e hoje some sem registro.
     *
     * Dentro do próprio `finally` e com o erro engolido: perder a medição de
     * uma varredura é ruim, perder a varredura por causa da medição é pior.
     */
    try {
      const linhas = linhasDeConsumo(ultimoUso);
      if (linhas.length > 0) {
        const { backendPostgres } = await import("./backend");
        await backendPostgres(ambienteId).registrarConsumo({
          origem: "scan",
          scanId,
          linhas,
        });
      }
    } catch (falha) {
      console.warn(
        `[executor] não consegui registrar consumo: ${(falha as Error).message}`,
      );
    }

    /**
     * O workspace some — **menos** quando a ingestão recusou.
     *
     * Ele é derivado do banco e regenerá-lo custa segundos, então guardar o de
     * uma falha qualquer só acumularia lixo. Mas recusa de ingestão é o caso em
     * que ele é a única evidência: o brief foi escrito e não entrou, e sem os
     * arquivos não há como saber o que o briefer produziu. Foi assim que se
     * perdeu o diagnóstico da segunda execução real.
     */
    if (ws && !preservarWorkspace) await descartar(ws);
    if (ws && preservarWorkspace) {
      console.warn(
        `[executor] workspace preservado para diagnóstico: ${ws.dir}`,
      );
    }
  }
}
