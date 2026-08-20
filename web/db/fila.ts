import "server-only";

/**
 * A fila de scans — no Postgres, não no Redis.
 *
 * A tabela `scan` já é a fila: tem o estado, o ambiente, o pedido e o índice
 * único que garante um scan rodando por cliente. Pôr o estado do trabalho no
 * Redis criaria duas fontes da verdade — um scan "rodando" lá e "enfileirado"
 * aqui — e reconciliar isso depois de um restart é trabalho que não precisa
 * existir.
 *
 * `FOR UPDATE SKIP LOCKED` é o padrão de fila do Postgres: dois trabalhadores
 * pegando ao mesmo tempo levam pedidos diferentes, sem corrida e sem trava
 * global. Na escala real — poucos scans por dia — a latência de polling é
 * irrelevante perto dos 20 minutos de execução.
 */

import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { comAmbiente } from "./cliente";
import * as t from "./schema";
import { executar, JaRodando, type PedidoDeScan } from "./executor";

/**
 * Teto de scans simultâneos no servidor inteiro. Protege o limite de taxa da
 * chave de API, que é compartilhada entre ambientes.
 *
 * **Provisório e declaradamente arbitrário.** Não existe telemetria de consumo
 * — o ledger não registra tokens —, então não dá para saber se o teto real são
 * 3 ou 15 (design-execucao-scan §5). Três é conservador; subir depois é uma
 * variável de ambiente.
 */
const TETO_GLOBAL = Number(process.env.RADAR_SCANS_SIMULTANEOS ?? 3);

export interface PedidoEnfileirado {
  scanId: string;
  scanRef: string;
  posicao: number;
}

/**
 * Enfileira um pedido. Não roda nada — quem roda é o trabalhador, noutro
 * processo, porque o scan leva de 12 a 63 minutos e nenhum ciclo de requisição
 * sobrevive a isso.
 */
export async function enfileirar(
  ambienteId: string,
  pedido: PedidoDeScan,
): Promise<PedidoEnfileirado> {
  return comAmbiente(ambienteId, async (tx) => {
    // O índice único cobre `rodando`; enfileirado precisa da checagem explícita,
    // senão a pessoa acumula pedidos que só vai descobrir depois.
    const emAndamento = await tx
      .select({ id: t.scan.id, estado: t.scan.estado })
      .from(t.scan)
      .where(
        sql`${t.scan.estado} in ('enfileirado','rodando','pesquisa','filtragem','redacao')`,
      );
    if (emAndamento.length > 0) throw new JaRodando();

    const todos = await tx.select({ id: t.scan.id }).from(t.scan);
    const agora = new Date();
    const ano = agora.getUTCFullYear();
    const semana = Math.ceil(
      ((agora.getTime() - Date.UTC(ano, 0, 1)) / 86400000 + 1) / 7,
    );
    const ref = `${ano}-W${String(semana).padStart(2, "0")}-scan-${String(todos.length + 1).padStart(3, "0")}`;

    const [linha] = await tx
      .insert(t.scan)
      .values({
        ambienteId,
        scanRef: ref,
        escopo: pedido.escopo,
        pilarFiltro: pedido.pilar ?? null,
        alvoQtd: pedido.alvo ?? null,
        estado: "enfileirado",
      })
      .returning({ id: t.scan.id });

    // A entrada da fila carrega só identificadores — é o que permite escolher o
    // próximo sem enxergar conteúdo de ninguém.
    await tx.insert(t.filaPedido).values({ scanId: linha.id, ambienteId });

    await tx.insert(t.evento).values({
      ambienteId,
      tipo: "scan-enfileirado",
      ator: "app:radar-web",
      scanId: linha.id,
      extra: { ...pedido },
    });

    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(t.filaPedido)
      .where(sql`${t.filaPedido.reivindicadoEm} is null`);

    return { scanId: linha.id, scanRef: ref, posicao: n };
  });
}

/**
 * Reivindica o próximo pedido, se houver vaga global.
 *
 * Roda como dono porque atravessa ambientes: a fila é do servidor, e escolher
 * o próximo exige enxergar todos. É a única operação do sistema com essa
 * natureza — por isso ela não passa por `comAmbiente`, e por isso está aqui
 * sozinha em vez de na camada.
 */
export async function reivindicar(
  urlDono = process.env.DATABASE_URL_MIGRATIONS,
): Promise<{
  scanId: string;
  ambienteId: string;
  pedido: PedidoDeScan;
} | null> {
  const pool = new Pool({ connectionString: urlDono });
  const db = drizzle(pool, { schema });

  try {
    return await db.transaction(async (tx) => {
      // Quantos rodando: sai da própria fila, contando os que já saíram dela
      // menos os que ainda estão. Perguntar à tabela `scan` exigiria enxergar
      // conteúdo de todos os ambientes.
      const [{ emVoo }] = await tx
        .select({ emVoo: sql<number>`count(*)::int` })
        .from(t.filaPedido)
        .where(sql`${t.filaPedido.reivindicadoEm} is not null`);

      if (emVoo >= TETO_GLOBAL) return null;

      // SKIP LOCKED: outro trabalhador segurando uma linha não bloqueia este —
      // ele simplesmente pega a seguinte.
      const { rows } = await tx.execute<{
        scan_id: string;
        ambiente_id: string;
      }>(sql`
        update fila_pedido set reivindicado_em = now()
        where scan_id = (
          select scan_id from fila_pedido
          where reivindicado_em is null
          order by criado_em
          limit 1
          for update skip locked
        )
        returning scan_id, ambiente_id
      `);

      const linha = rows[0];
      if (!linha) return null;

      // O pedido em si é do ambiente, e é lido com o ambiente declarado.
      const pedido = await comAmbiente(linha.ambiente_id, async (tx2) => {
        const [scan] = await tx2
          .select()
          .from(t.scan)
          .where(eq(t.scan.id, linha.scan_id));
        return {
          escopo: scan.escopo,
          pilar: scan.pilarFiltro ?? undefined,
          alvo: scan.alvoQtd ?? undefined,
        };
      });

      return { scanId: linha.scan_id, ambienteId: linha.ambiente_id, pedido };
    });
  } finally {
    await pool.end();
  }
}

/**
 * Um giro do trabalhador: pega o próximo e executa.
 *
 * O mesmo `scan` atravessa enfileirado → rodando → concluído. A identidade
 * sobrevive porque a tela acompanha por id desde o pedido, e porque o evento de
 * enfileiramento precisa continuar apontando para algo.
 */
export async function girar(): Promise<{ rodou: boolean; scanRef?: string }> {
  const proximo = await reivindicar();
  if (!proximo) return { rodou: false };

  try {
    const r = await executar(
      proximo.ambienteId,
      proximo.pedido,
      proximo.scanId,
    );
    return { rodou: true, scanRef: r.scanRef };
  } finally {
    // A linha sai da fila ao terminar, dê certo ou não. Deixá-la marcada como
    // em voo ocuparia uma vaga global para sempre.
    await liberar(proximo.scanId);
  }
}

/** Tira o pedido da fila. Sem RLS: a tabela não guarda conteúdo. */
async function liberar(
  scanId: string,
  urlDono = process.env.DATABASE_URL_MIGRATIONS,
) {
  const pool = new Pool({ connectionString: urlDono });
  try {
    await pool.query("delete from fila_pedido where scan_id = $1", [scanId]);
  } finally {
    await pool.end();
  }
}
