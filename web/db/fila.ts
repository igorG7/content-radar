import "server-only";

/**
 * O lado **trabalhador** da fila de scans — no Postgres, não no Redis.
 *
 * Pedir uma varredura é operação de um ambiente só e mora na camada
 * (`enfileirarScan`). O que vive aqui atravessa ambientes: escolher o próximo
 * exige enxergar a fila inteira, e por isso roda como dono. Manter os dois
 * lados no mesmo arquivo faria o app carregar o executor — e com ele o SDK do
 * agente — só para exibir uma tela.
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
import { executar } from "./executor";
import type { PedidoDeScan } from "../lib/store";

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
