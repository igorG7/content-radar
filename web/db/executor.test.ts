import { describe, expect, it, afterAll, beforeAll } from "vitest";
import { Pool } from "pg";
import { executar, JaRodando } from "./executor";
import { encerrarPool } from "./cliente";

/**
 * O executor em si depende de chamada de API e leva dezenas de minutos, então
 * não é exercitado aqui. O que se testa é o que falha rápido e cala: a vaga do
 * ambiente e o registro de falha.
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

/**
 * Ambiente próprio, com vault vazio. Assim toda falha acontece na
 * materialização — antes de qualquer chamada de API. Testar o executor contra
 * um ambiente preenchido dispararia um scan de verdade: dezenas de minutos e
 * dinheiro gasto para verificar uma recusa.
 */
const SLUG = "teste-executor";
let ambienteId = "";

async function sql(
  q: string,
  p: unknown[] = [],
): Promise<Record<string, unknown>[]> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_MIGRATIONS,
  });
  await pool.query("begin");
  await pool.query("select set_config('app.ambiente', $1, true)", [ambienteId]);
  const { rows } = await pool.query(q, p);
  await pool.query("commit");
  await pool.end();
  return rows;
}

beforeAll(async () => {
  if (!disponivel) return;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_MIGRATIONS,
  });
  await pool.query("delete from ambiente where slug = $1", [SLUG]);
  const { rows } = await pool.query(
    "insert into ambiente (slug, nome, prefixo_midia) values ($1,$1,$1) returning id",
    [SLUG],
  );
  ambienteId = rows[0].id;
  await pool.end();
});

afterAll(async () => {
  if (disponivel) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL_MIGRATIONS,
    });
    await pool.query("delete from ambiente where slug = $1", [SLUG]);
    await pool.end();
  }
  await encerrarPool();
});

describe.skipIf(!disponivel)("executor", () => {
  it("recusa o segundo scan do mesmo ambiente, em vez de enfileirar calado", async () => {
    await sql(
      `insert into scan (ambiente_id, scan_ref, escopo, estado)
       values ($1,'2026-W99-scan-001','local','rodando')`,
      [ambienteId],
    );

    // Sem isto, um usuário dispara cinco scans, ocupa as vagas e os outros
    // esperam — o oposto do requisito.
    await expect(
      executar(ambienteId, { escopo: "local" }),
    ).rejects.toBeInstanceOf(JaRodando);
  });

  it("registra a falha com o estágio em que parou", async () => {
    await sql("delete from scan");

    // Vault vazio: materializar recusa, e a falha acontece antes de qualquer
    // chamada de API.
    const r = await executar(ambienteId, { escopo: "local" });

    expect(r.estado).toBe("falhou");
    expect(r.erro).toMatch(/vault/i);

    const [linha] = await sql("select estado from scan where scan_ref = $1", [
      r.scanRef,
    ]);
    expect(linha.estado).toBe("falhou");

    const eventos = await sql(
      "select tipo, extra from evento where tipo = 'scan-aborted'",
    );
    expect(eventos.length).toBeGreaterThan(0);
    // Falhar na pesquisa de 10 fontes é problema diferente de falhar na
    // redação; o evento precisa dizer qual foi.
    expect((eventos[0].extra as { estagio: string }).estagio).toBe("nenhum");
  });

  it("o banco recusa dois scans rodando no mesmo ambiente", async () => {
    await sql("delete from scan");
    await sql(
      `insert into scan (ambiente_id, scan_ref, escopo, estado)
       values ($1,'2026-W99-scan-a','local','rodando')`,
      [ambienteId],
    );

    // A garantia é o índice único parcial (migração 0004), não a checagem na
    // aplicação. Testar pela aplicação seria testar a mensagem; o que precisa
    // valer é a recusa, independentemente de tempo, ordem ou de quem escreveu
    // o código que insere.
    await expect(
      sql(
        `insert into scan (ambiente_id, scan_ref, escopo, estado)
         values ($1,'2026-W99-scan-b','local','rodando')`,
        [ambienteId],
      ),
    ).rejects.toThrow(/scan_um_rodando_por_ambiente/);

    await sql("delete from scan");
  });

  it("descarta o próprio workspace, mesmo em falha", async () => {
    const { access } = await import("node:fs/promises");

    // Verifica o diretório DESTA execução, não uma contagem de /tmp: outros
    // arquivos de teste criam workspaces em paralelo, e observar recurso global
    // torna o teste instável por construção.
    const r = await executar(ambienteId, { escopo: "local" });
    if (!r.workspace) return;

    const existe = await access(r.workspace)
      .then(() => true)
      .catch(() => false);
    expect(existe).toBe(false);
  });
});
