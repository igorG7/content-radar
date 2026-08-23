import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { bancoDisponivel } from "./teste-banco";
import { backendPostgres } from "./backend";
import { encerrarPool } from "./cliente";

/**
 * O vault no banco: versão nova a cada gravação, com motivo, e o histórico
 * nascendo junto na mesma transação.
 */

const disponivel = await bancoDisponivel();

const SLUG =
  "teste-vault-" + Math.abs(Number(process.env.VITEST_WORKER_ID ?? 1));
let ambienteId = "";

describe.skipIf(!disponivel)("vault no banco", () => {
  beforeAll(async () => {
    const dono = new Pool({
      connectionString: process.env.DATABASE_URL_MIGRATIONS,
    });
    const { rows } = await dono.query(
      `insert into ambiente (slug, nome, prefixo_midia) values ($1,$1,$1) returning id`,
      [SLUG],
    );
    ambienteId = rows[0].id;
    await dono.query("begin");
    await dono.query("select set_config('app.ambiente', $1, true)", [
      ambienteId,
    ]);
    await dono.query(
      `insert into vault_bloco (ambiente_id, slug, titulo, corpo, ordem, escopo, contrato)
       values ($1,'voz','Voz da marca','',1,'sempre','obrigatorio')`,
      [ambienteId],
    );
    await dono.query("commit");
    await dono.end();
  });

  afterAll(async () => {
    const dono = new Pool({
      connectionString: process.env.DATABASE_URL_MIGRATIONS,
    });
    await dono.query("delete from ambiente where id = $1", [ambienteId]);
    await dono.end();
    await encerrarPool();
  });

  it("bloco vazio não conta como preenchido", async () => {
    const blocos = await backendPostgres(ambienteId).listarBlocos();
    expect(blocos.find((b) => b.slug === "voz")?.corpo).toBe("");
  });

  it("a primeira gravação é a v1, não a v2", async () => {
    // O provisionamento cria a linha, mas isso não é uma versão: ninguém
    // respondeu nada ainda.
    const store = backendPostgres(ambienteId);
    await store.gravarBloco(
      "voz",
      "Fala direto.",
      "criado nos primeiros passos",
    );
    const bloco = (await store.listarBlocos()).find((b) => b.slug === "voz")!;
    expect(bloco.versao).toBe(1);
    expect(bloco.corpo).toBe("Fala direto.");
  });

  it("regravar incrementa a versão e guarda o histórico com o motivo", async () => {
    const store = backendPostgres(ambienteId);
    await store.gravarBloco(
      "voz",
      "Fala direto, sem prometer nada.",
      "acrescentei a proibição",
    );

    const bloco = (await store.listarBlocos()).find((b) => b.slug === "voz")!;
    expect(bloco.versao).toBe(2);

    const dono = new Pool({
      connectionString: process.env.DATABASE_URL_MIGRATIONS,
    });
    await dono.query("begin");
    await dono.query("select set_config('app.ambiente', $1, true)", [
      ambienteId,
    ]);
    const { rows } = await dono.query(
      "select versao, motivo, corpo from vault_bloco_versao where slug='voz' order by versao",
    );
    await dono.query("commit");
    await dono.end();

    expect(rows.map((r) => [r.versao, r.motivo])).toEqual([
      ["1", "criado nos primeiros passos"],
      ["2", "acrescentei a proibição"],
    ]);
    // O histórico guarda o corpo anterior, não só a notícia da mudança.
    expect(rows[0].corpo).toBe("Fala direto.");
  });

  it("bloco inexistente é recusado", async () => {
    await expect(
      backendPostgres(ambienteId).gravarBloco("nao-existe", "x", "y"),
    ).rejects.toThrow(/não existe/i);
  });
});
