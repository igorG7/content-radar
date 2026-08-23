import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { bancoDisponivel } from "./teste-banco";
import { backendPostgres } from "./backend";
import { encerrarPool } from "./cliente";
import { MANIFEST_PATH, escreverAtomico } from "../lib/manifest";

/**
 * A configuração passou a viver no banco. O manifest.yaml continua recebendo a
 * mesma mudança enquanto as skills o lerem — projeção de uma fonte só.
 */

const disponivel = await bancoDisponivel();

let ambienteId = "";
let manifestOriginal = "";
const SLUG = "teste-config";

describe.skipIf(!disponivel)("configuração no banco", () => {
  beforeAll(async () => {
    manifestOriginal = await readFile(MANIFEST_PATH, "utf8");
    const dono = new Pool({
      connectionString: process.env.DATABASE_URL_MIGRATIONS,
    });
    const { rows } = await dono.query(
      "insert into ambiente (slug, nome, prefixo_midia) values ($1,$1,$1) returning id",
      [SLUG],
    );
    ambienteId = rows[0].id;
    await dono.query("begin");
    await dono.query("select set_config('app.ambiente', $1, true)", [
      ambienteId,
    ]);
    await dono.query(
      `insert into config (ambiente_id, pesos, caps, janelas, volume)
       values ($1, '{"pillar_fit":0.30}', '{"match_score_min":0.55}', '{"publicado_days":90}', '{"candidates_per_week_target":10}')`,
      [ambienteId],
    );
    await dono.query("commit");
    await dono.end();
  });

  afterAll(async () => {
    // Atômico: restaurar com writeFile truncava o arquivo, e quem o lesse
    // nesse instante recebia YAML vazio.
    await escreverAtomico(MANIFEST_PATH, manifestOriginal);
    const dono = new Pool({
      connectionString: process.env.DATABASE_URL_MIGRATIONS,
    });
    await dono.query("delete from ambiente where id = $1", [ambienteId]);
    await dono.end();
    await encerrarPool();
  });

  it("lê a configuração do ambiente, não do arquivo", async () => {
    const c = await backendPostgres(ambienteId).configuracao();
    expect(c.pesos.pillar_fit).toBe(0.3);
    expect(c.caps.match_score_min).toBe(0.55);
  });

  it("gravar muda o banco", async () => {
    const store = backendPostgres(ambienteId);
    await store.gravarConfiguracao([
      { path: ["anti_repetition", "match_score_min"], value: 0.6 },
    ]);
    expect((await store.configuracao()).caps.match_score_min).toBe(0.6);
  });

  it("um ambiente não reescreve o manifest de outro", async () => {
    // Existe um manifest.yaml e ele pertence a target_company.slug. Sem esta
    // fronteira, o ambiente de um cliente reescreveria a configuração das
    // skills de outro — o vazamento que o RLS impede no banco, entrando pela
    // porta do arquivo.
    const antes = await readFile(MANIFEST_PATH, "utf8");

    // Este ambiente de teste não é o dono do manifest.
    await backendPostgres(ambienteId).gravarConfiguracao([
      { path: ["anti_repetition", "match_score_min"], value: 0.99 },
    ]);

    expect(await readFile(MANIFEST_PATH, "utf8")).toBe(antes);
    // ...mas a configuração dele mudou.
    expect(
      (await backendPostgres(ambienteId).configuracao()).caps.match_score_min,
    ).toBe(0.99);
  });

  it("caminho fora da configuração é recusado, não ignorado", async () => {
    await expect(
      backendPostgres(ambienteId).gravarConfiguracao([
        { path: ["open_design", "url"], value: "x" },
      ]),
    ).rejects.toThrow(/fora da configuração/i);
  });
});
