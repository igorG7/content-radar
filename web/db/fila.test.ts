import { describe, expect, it, afterAll, beforeAll } from "vitest";
import { Pool } from "pg";
import { reivindicar } from "./fila";
import { backendPostgres } from "./backend";
import { JaRodando } from "../lib/store";
import { encerrarPool } from "./cliente";

const enfileirar = (
  ambienteId: string,
  pedido: { escopo: string; alvo?: number },
) => backendPostgres(ambienteId).enfileirarScan(pedido);

/**
 * A fila é a própria tabela `scan`. O que se exige dela: reivindicação atômica,
 * teto global respeitado, e a identidade do scan sobrevivendo do pedido à
 * execução.
 */

const disponivel = await (async () => {
  if (!process.env.DATABASE_URL_MIGRATIONS) return false;
  const sonda = new Pool({
    connectionString: process.env.DATABASE_URL_MIGRATIONS,
  });
  try {
    await sonda.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    await sonda.end();
  }
})();

const A = "teste-fila-a";
const B = "teste-fila-b";
const ids: Record<string, string> = {};

async function dono(q: string, p: unknown[] = []) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_MIGRATIONS,
  });
  const { rows } = await pool.query(q, p);
  await pool.end();
  return rows;
}

/**
 * Zera fila e scans dos ambientes de teste.
 *
 * O delete de `scan` precisa do ambiente declarado: sob FORCE ROW LEVEL
 * SECURITY o dono também não enxerga linha nenhuma, e a limpeza viraria um
 * no-op silencioso — o mesmo tropeço que quebrou a primeira versão da fila.
 * `fila_pedido` não tem RLS, então basta apagar.
 */
async function limpar() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_MIGRATIONS,
  });
  try {
    for (const slug of [A, B]) {
      if (!ids[slug]) continue;
      await pool.query("delete from fila_pedido where ambiente_id = $1", [
        ids[slug],
      ]);
      await pool.query("begin");
      await pool.query("select set_config('app.ambiente', $1, true)", [
        ids[slug],
      ]);
      await pool.query("delete from scan");
      await pool.query("commit");
    }
  } finally {
    await pool.end();
  }
}

beforeAll(async () => {
  if (!disponivel) return;
  for (const slug of [A, B]) {
    await dono("delete from ambiente where slug = $1", [slug]);
    const rows = await dono(
      "insert into ambiente (slug, nome, prefixo_midia) values ($1,$1,$1) returning id",
      [slug],
    );
    ids[slug] = rows[0].id;
  }
});

afterAll(async () => {
  if (disponivel) {
    for (const slug of [A, B])
      await dono("delete from ambiente where slug = $1", [slug]);
  }
  await encerrarPool();
});

describe.skipIf(!disponivel)("fila", () => {
  it("enfileira e devolve a posição", async () => {
    await limpar();
    const r = await enfileirar(ids[A], { escopo: "local", alvo: 3 });
    expect(r.scanRef).toMatch(/^\d{4}-W\d{2}-scan-\d{3}$/);
    expect(r.posicao).toBeGreaterThanOrEqual(1);
  });

  it("recusa o segundo pedido do mesmo ambiente em vez de acumular calado", async () => {
    // Monta o próprio cenário: teste que depende do estado deixado por outro
    // passa só na ordem certa, e some quando alguém reordena ou roda um só.
    await limpar();
    await enfileirar(ids[A], { escopo: "local" });

    // Enfileirar em silêncio faria a pessoa descobrir o acúmulo só depois.
    await expect(
      enfileirar(ids[A], { escopo: "trends" }),
    ).rejects.toBeInstanceOf(JaRodando);
  });

  it("ambientes diferentes não disputam vaga", async () => {
    await limpar();
    await enfileirar(ids[A], { escopo: "local" });

    // O requisito do owner: o scan de um não espera o término do de outro.
    const r = await enfileirar(ids[B], { escopo: "trends" });
    expect(r.scanRef).toBeTruthy();
  });

  it("reivindicar entrega um pedido de cada vez, sem repetir", async () => {
    await limpar();
    await enfileirar(ids[A], { escopo: "local" });
    await enfileirar(ids[B], { escopo: "trends" });

    const primeiro = await reivindicar();
    expect(primeiro).not.toBeNull();

    // Marca como rodando, como o executor faria.
    await dono("update scan set estado = 'rodando' where id = $1", [
      primeiro!.scanId,
    ]);

    const segundo = await reivindicar();
    expect(segundo?.scanId).not.toBe(primeiro!.scanId);
  });

  it("respeita o teto global, que é do servidor e não do ambiente", async () => {
    await limpar();
    // O teto protege o limite de taxa da chave de API, que é compartilhada.
    // Enche a fila de "em voo" até o teto e confirma que nada mais sai.
    const teto = Number(process.env.RADAR_SCANS_SIMULTANEOS ?? 3);
    await dono(
      `update fila_pedido set reivindicado_em = now() where reivindicado_em is null`,
    );
    for (let i = 0; i < teto; i++) {
      await dono(
        `insert into fila_pedido (scan_id, ambiente_id, reivindicado_em)
         values (gen_random_uuid(), $1, now())`,
        [ids[A]],
      );
    }
    await dono(
      `insert into fila_pedido (scan_id, ambiente_id) values (gen_random_uuid(), $1)`,
      [ids[B]],
    );

    expect(await reivindicar()).toBeNull();
  });

  it("a fila não guarda conteúdo de cliente", async () => {
    // É o que permite escolher o próximo sem RLS: quem lê a fila vê id e
    // momento, não brief, vault nem configuração.
    const colunas = await dono(
      `select column_name from information_schema.columns
       where table_name = 'fila_pedido'`,
    );
    expect(colunas.map((c) => c.column_name).sort()).toEqual([
      "ambiente_id",
      "criado_em",
      "reivindicado_em",
      "scan_id",
    ]);
  });
});
