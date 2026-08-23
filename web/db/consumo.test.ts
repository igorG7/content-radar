import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { bancoDisponivel } from "./teste-banco";
import { backendPostgres } from "./backend";
import { encerrarPool } from "./cliente";
import { linhasDeConsumo } from "../lib/telemetria";

/**
 * A telemetria de consumo. O que se exige dela: que não invente, que não some
 * duas vezes, que não vaze entre clientes — e que não possa ser reescrita
 * depois, porque registro de custo que se edita não serve para conferir fatura.
 */

const disponivel = await bancoDisponivel();
const SLUG = `teste-consumo-${process.pid}`;
let ambienteId = "";
let outroId = "";
let scanId = "";

async function dono(q: string, p: unknown[] = []) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_MIGRATIONS,
  });
  const { rows } = await pool.query(q, p);
  await pool.end();
  return rows;
}

async function comoApp(id: string, q: string, p: unknown[] = []) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query("begin");
    await pool.query("select set_config('app.ambiente', $1, true)", [id]);
    const { rows } = await pool.query(q, p);
    await pool.query("commit");
    return rows;
  } finally {
    await pool.end();
  }
}

beforeAll(async () => {
  if (!disponivel) return;
  for (const s of [SLUG, `${SLUG}-outro`]) {
    await dono("delete from ambiente where slug = $1", [s]);
  }
  [{ id: ambienteId }] = await dono(
    "insert into ambiente (slug, nome, prefixo_midia) values ($1,$1,$1) returning id",
    [SLUG],
  );
  [{ id: outroId }] = await dono(
    "insert into ambiente (slug, nome, prefixo_midia) values ($1,$1,$1) returning id",
    [`${SLUG}-outro`],
  );
  [{ id: scanId }] = await comoApp(
    ambienteId,
    `insert into scan (ambiente_id, scan_ref, escopo, alvo_qtd, estado)
     values ($1,'2026-W34-consumo','seasonal',3,'concluido') returning id`,
    [ambienteId],
  );
});

afterAll(async () => {
  if (disponivel) {
    for (const s of [SLUG, `${SLUG}-outro`]) {
      await dono("delete from ambiente where slug = $1", [s]);
    }
  }
  await encerrarPool();
});

const usoDeExemplo = {
  "claude-opus-5": {
    inputTokens: 1000,
    outputTokens: 500,
    cacheReadInputTokens: 20000,
    cacheCreationInputTokens: 3000,
    webSearchRequests: 0,
    costUSD: 1.234567,
  },
  "claude-haiku-4-5": {
    inputTokens: 800,
    outputTokens: 200,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    webSearchRequests: 14,
    costUSD: 0.05,
  },
};

describe.skipIf(!disponivel)("consumo por execução", () => {
  it("grava uma linha por modelo e agrega por execução", async () => {
    const store = backendPostgres(ambienteId);
    await store.registrarConsumo({
      origem: "scan",
      scanId,
      linhas: linhasDeConsumo(usoDeExemplo),
    });

    const [gasto] = await store.consumoRecente();
    expect(gasto.origem).toBe("scan");
    expect(gasto.modelos).toBe(2);
    // 1,234567 + 0,05 — somado no banco como numeric, não em ponto flutuante.
    expect(gasto.custoUsd).toBeCloseTo(1.284567, 6);
    expect(gasto.tokens).toBe(1000 + 500 + 20000 + 3000 + 800 + 200);
    expect(gasto.buscasWeb).toBe(14);
    // O rótulo vem do scan: número solto sem saber de qual varredura não serve.
    expect(gasto.rotulo).toBe("2026-W34-consumo");
  });

  it("não deixa um ambiente ver o consumo de outro", async () => {
    // Custo é dado comercial. Vazar aqui é pior que vazar pauta.
    const doOutro = await backendPostgres(outroId).consumoRecente();
    expect(doOutro).toHaveLength(0);
  });

  it("é append-only: a aplicação não reescreve nem apaga", async () => {
    // Mesmo motivo do ledger. Se dá para editar, não serve para conferir fatura.
    await expect(
      comoApp(ambienteId, "update consumo set custo_usd = 0"),
    ).rejects.toThrow(/permission denied|permissão negada/i);
    await expect(comoApp(ambienteId, "delete from consumo")).rejects.toThrow(
      /permission denied|permissão negada/i,
    );
  });

  it("não grava nada quando não houve consumo", async () => {
    // Execução que morreu na partida devolve modelUsage zerado. Uma linha de
    // zeros apareceria no detalhamento como se tivesse custado.
    const antes = (await backendPostgres(ambienteId).consumoRecente()).length;
    await backendPostgres(ambienteId).registrarConsumo({
      origem: "chat",
      linhas: linhasDeConsumo({
        m: {
          inputTokens: 0,
          outputTokens: 0,
          cacheReadInputTokens: 0,
          cacheCreationInputTokens: 0,
          webSearchRequests: 0,
          costUSD: 0,
        },
      }),
    });
    expect((await backendPostgres(ambienteId).consumoRecente()).length).toBe(
      antes,
    );
  });

  it("recusa consumo apontando para scan de outro cliente", async () => {
    // A chave composta com o ambiente é o que impede isso — sem ela o banco
    // aceitaria o vínculo cruzado e a conta de um cliente citaria o outro.
    await expect(
      backendPostgres(outroId).registrarConsumo({
        origem: "scan",
        scanId,
        linhas: linhasDeConsumo(usoDeExemplo),
      }),
    ).rejects.toThrow();
  });
});
