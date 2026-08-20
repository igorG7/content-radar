import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { backendPostgres } from "./backend";
import { encerrarPool } from "./cliente";
import { JaRodando } from "../lib/store";

/**
 * O que a tela precisa saber de uma varredura em voo: em que estágio está, há
 * quanto tempo foi pedida, e — enquanto espera vaga global — que lugar ocupa na
 * fila. Sem a posição, "iniciando" fica parado por minutos sem explicação
 * (design-execucao-scan §7).
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

const A = "teste-andamento-a";
const B = "teste-andamento-b";
const ids: Record<string, string> = {};

async function dono(q: string, p: unknown[] = []) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_MIGRATIONS,
  });
  const { rows } = await pool.query(q, p);
  await pool.end();
  return rows;
}

async function noAmbiente(slug: string, q: string, p: unknown[] = []) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_MIGRATIONS,
  });
  try {
    await pool.query("begin");
    await pool.query("select set_config('app.ambiente', $1, true)", [
      ids[slug],
    ]);
    const { rows } = await pool.query(q, p);
    await pool.query("commit");
    return rows;
  } finally {
    await pool.end();
  }
}

/** Zera fila e scans dos ambientes de teste, com o ambiente declarado — sob
 *  FORCE RLS o dono também não enxerga linha nenhuma. */
async function limpar() {
  for (const slug of [A, B]) {
    if (!ids[slug]) continue;
    await dono("delete from fila_pedido where ambiente_id = $1", [ids[slug]]);
    await noAmbiente(slug, "delete from evento where scan_id is not null");
    await noAmbiente(slug, "delete from scan");
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
    for (const slug of [A, B]) {
      await dono("delete from ambiente where slug = $1", [slug]);
    }
  }
  await encerrarPool();
});

describe.skipIf(!disponivel)("varredura em andamento", () => {
  it("não há nada em voo quando nada foi pedido", async () => {
    await limpar();
    expect(await backendPostgres(ids[A]).scanEmAndamento()).toBeNull();
  });

  it("mostra a posição enquanto o pedido espera vaga", async () => {
    await limpar();
    // B pede primeiro; a posição de A precisa refletir a fila do servidor
    // inteiro, não a do próprio ambiente — a vaga disputada é global.
    //
    // A afirmação é essa, e não um número: A tem **um** pedido pendente, então
    // uma contagem por ambiente daria sempre 1. Qualquer valor acima disso só
    // é possível contando a fila inteira. Asserções em "2" ou em "posição de B
    // mais um" passavam sozinhas e quebravam com a suíte, porque outro arquivo
    // enfileira no mesmo intervalo — o número absoluto não é do teste.
    await backendPostgres(ids[B]).enfileirarScan({ escopo: "trends" });
    await backendPostgres(ids[A]).enfileirarScan({ escopo: "local", alvo: 3 });

    const deB = await backendPostgres(ids[B]).scanEmAndamento();
    const deA = await backendPostgres(ids[A]).scanEmAndamento();
    expect(deA?.estado).toBe("enfileirado");
    expect(deA?.posicao).toBeGreaterThan(1);
    expect(deA?.posicao ?? 0).toBeGreaterThan(deB?.posicao ?? 0);
    expect(deA?.pedido).toEqual({ escopo: "local", pilar: undefined, alvo: 3 });
    expect(deA?.iniciadoEm).toBeNull();
  });

  it("para de prometer posição depois que o pedido saiu da fila", async () => {
    await limpar();
    const { scanId } = await backendPostgres(ids[A]).enfileirarScan({
      escopo: "local",
    });
    await dono(
      "update fila_pedido set reivindicado_em = now() where scan_id = $1",
      [scanId],
    );
    await noAmbiente(
      A,
      "update scan set estado = 'pesquisa', iniciado_em = now() where id = $1",
      [scanId],
    );

    // "3º da fila" depois de reivindicado seria mentira: já não há espera.
    const scan = await backendPostgres(ids[A]).scanEmAndamento();
    expect(scan?.posicao).toBeNull();
    expect(scan?.estado).toBe("pesquisa");
    expect(scan?.iniciadoEm).not.toBeNull();
  });

  it("entrega os estágios já vencidos com a contagem parcial de cada um", async () => {
    await limpar();
    const { scanId } = await backendPostgres(ids[A]).enfileirarScan({
      escopo: "local",
    });
    for (const [estagio, minuto, extra] of [
      ["pesquisa", 4.2, { achados: 9, fontes_lidas: 5 }],
      ["filtragem", 7.1, { promovidos: 3, descartados_score: 6 }],
    ] as const) {
      await noAmbiente(
        A,
        `insert into evento (ambiente_id, tipo, ator, scan_id, extra)
         values ($1,'scan-stage','app:radar-executor',$2,$3)`,
        [ids[A], scanId, JSON.stringify({ estagio, minuto, ...extra })],
      );
    }

    const scan = await backendPostgres(ids[A]).scanEmAndamento();
    expect(scan?.estagios.map((e) => e.estagio)).toEqual([
      "pesquisa",
      "filtragem",
    ]);
    // A contagem parcial vem separada do estágio e do minuto: é ela que torna a
    // cauda uma consulta em vez de um script (design-execucao-scan §9.1).
    expect(scan?.estagios[0].extra).toEqual({ achados: 9, fontes_lidas: 5 });
    expect(scan?.estagios[1].minuto).toBe(7.1);
  });

  it("recusa o segundo pedido do mesmo ambiente", async () => {
    await limpar();
    await backendPostgres(ids[A]).enfileirarScan({ escopo: "local" });

    // Enfileirar em silêncio faria a pessoa descobrir o acúmulo quando dois
    // scans iguais gerassem pauta repetida.
    await expect(
      backendPostgres(ids[A]).enfileirarScan({ escopo: "trends" }),
    ).rejects.toBeInstanceOf(JaRodando);
  });

  it("um ambiente não enxerga a varredura do outro", async () => {
    await limpar();
    await backendPostgres(ids[B]).enfileirarScan({ escopo: "trends" });

    expect(await backendPostgres(ids[A]).scanEmAndamento()).toBeNull();
  });
});
