import { describe, expect, it, afterAll } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { Pool } from "pg";
import { ambienteSemeado } from "./teste-banco";
import { materializar, descartar, colher, type Workspace } from "./workspace";
import { encerrarPool } from "./cliente";

/**
 * A fase 4 troca "a skill lê o store compartilhado" por "a skill lê um
 * workspace do ambiente". O que se exige daqui é que o banco reconstitua o que
 * as skills esperam — e que um ambiente não alcance o de outro.
 */

const disponivel = await ambienteSemeado("avanz-imoveis");

async function idDe(slug: string): Promise<string> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_MIGRATIONS,
  });
  const { rows } = await pool.query("select id from ambiente where slug=$1", [
    slug,
  ]);
  await pool.end();
  return rows[0].id;
}

const criados: Workspace[] = [];
const ambientesCriados: string[] = [];
afterAll(async () => {
  for (const ws of criados) await descartar(ws);
  if (ambientesCriados.length > 0) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL_MIGRATIONS,
    });
    await pool.query("delete from ambiente where id = any($1::uuid[])", [
      ambientesCriados,
    ]);
    await pool.end();
  }
  await encerrarPool();
});

describe.skipIf(!disponivel)("workspace materializado", () => {
  it("reconstrói o manifest que a skill lê, do banco", async () => {
    const ws = await materializar(await idDe("avanz-imoveis"));
    criados.push(ws);

    const manifest = parse(
      await readFile(path.join(ws.dir, "manifest.yaml"), "utf8"),
    );
    expect(Object.keys(manifest.search_scopes).length).toBeGreaterThan(0);
    expect(manifest.anti_repetition.match_score_weights.pillar_fit).toBe(0.3);
    // O vault apontado é o de dentro do workspace, não o do disco da empresa.
    expect(manifest.target_company.vault_path.startsWith(ws.dir)).toBe(true);
  });

  it("materializa os blocos do vault como arquivos do always_load", async () => {
    const ws = criados[0];
    const manifest = parse(
      await readFile(path.join(ws.dir, "manifest.yaml"), "utf8"),
    );
    for (const rel of manifest.target_company.always_load) {
      const texto = await readFile(path.join(ws.dir, rel), "utf8");
      expect(texto.length).toBeGreaterThan(0);
    }
    expect(manifest.target_company.always_load.length).toBe(ws.blocos);
  });

  it("expõe os códigos que os briefs citam", async () => {
    const ws = criados[0];
    const pilares = await readFile(
      path.join(ws.dir, "vault/pilares.md"),
      "utf8",
    );
    expect(pilares).toContain("`decisao-inteligente`");
    // Pilar fora do escopo do radar aparece marcado, não some: some faria o
    // agente achar que pode classificar nele.
    expect(pilares).toContain("fora do escopo do radar");

    const temas = await readFile(path.join(ws.dir, "vault/temas.md"), "utf8");
    expect(temas).toContain("`B10`");
  });

  it("materializa os fatos da marca como valor, não como prosa", async () => {
    const ws = criados[0];
    const manifest = parse(
      await readFile(path.join(ws.dir, "manifest.yaml"), "utf8"),
    );
    // A skill injeta o telefone no must_have da arte e no package. Extrair de
    // prosa por regex seria a fragilidade que a forma de bloco evita.
    expect(manifest.target_company.brand_facts.phone_display).toMatch(
      /^\(\d{2}\)/,
    );
    expect(manifest.target_company.brand_facts.main_channel).toBe("WhatsApp");
  });

  it("materializa os templates de geração por pilar", async () => {
    const ws = criados[0];
    const manifest = parse(
      await readFile(path.join(ws.dir, "manifest.yaml"), "utf8"),
    );
    const comTemplate = Object.keys(manifest.target_company.per_pillar);
    expect(comTemplate.length).toBeGreaterThan(0);

    for (const pilar of comTemplate) {
      for (const rel of manifest.target_company.per_pillar[pilar]) {
        const json = JSON.parse(await readFile(path.join(ws.dir, rel), "utf8"));
        expect(typeof json).toBe("object");
      }
    }
  });

  it("os temas trazem o pilar junto, porque o código só é único dentro dele", async () => {
    const ws = criados[0];
    const temas = await readFile(path.join(ws.dir, "vault/temas.md"), "utf8");
    // `B10` existe em mais de um banco; sem o pilar ao lado, a citação de um
    // brief não se resolve.
    expect(temas).toMatch(/`B10` \(decisao-inteligente\)/);
  });

  it("materializa os briefs para a anti-repetição, sem o corpo", async () => {
    const ws = criados[0];
    const fila = await readdir(
      path.join(ws.dir, "store/briefs/pendente-aprovacao"),
    );
    expect(fila.length).toBeGreaterThan(0);

    const um = await readFile(
      path.join(ws.dir, "store/briefs/pendente-aprovacao", fila[0]),
      "utf8",
    );
    expect(um).toContain("topic_hash:");
    // Só frontmatter: mandar a legenda inteira aumentaria o contexto sem mudar
    // a decisão de redundância.
    expect(um.split("---")[2].trim()).toBe("");
  });

  it("o ledger nasce vazio, e a colheita devolve só o que a execução escreveu", async () => {
    const ws = criados[0];
    expect(
      await readFile(path.join(ws.dir, "store/ledger.jsonl"), "utf8"),
    ).toBe("");

    const colheita = await colher(ws);
    expect(colheita.eventos).toEqual([]);
    // Os briefs materializados não contam como novos: eles vieram do banco.
    expect(colheita.briefsNovos).toEqual([]);
  });

  it("a colheita separa o que a execução escreveu do que veio do banco", async () => {
    const ws = criados[0];
    const { writeFile, appendFile } = await import("node:fs/promises");

    // O que uma execução deixaria: um brief com corpo e eventos no ledger.
    await writeFile(
      path.join(ws.dir, "store/briefs/pendente-aprovacao/2026-W99-001_novo.md"),
      "---\nbrief_id: 2026-W99-001\nslug: 2026-W99-001_novo\n---\n\nCorpo do brief.\n",
      "utf8",
    );
    await appendFile(
      path.join(ws.dir, "store/ledger.jsonl"),
      JSON.stringify({
        ts: new Date().toISOString(),
        event: "scan-started",
        actor: "skill:radar-scan",
      }) +
        "\n" +
        JSON.stringify({
          ts: new Date().toISOString(),
          event: "brief-created",
          brief_id: "2026-W99-001",
        }) +
        "\n",
      "utf8",
    );

    const colheita = await colher(ws);
    expect(colheita.eventos.map((e) => e.event)).toEqual([
      "scan-started",
      "brief-created",
    ]);
    // Os 34 materializados não contam: só frontmatter, sem corpo.
    expect(colheita.briefsNovos.map((b) => b.slug)).toEqual([
      "2026-W99-001_novo",
    ]);
  });

  it("um ambiente não alcança o vault de outro", async () => {
    /**
     * O segundo ambiente é criado aqui, não pressuposto.
     *
     * Antes o teste procurava um `cliente-novo` que alguém tinha criado à mão
     * no banco de desenvolvimento. Funcionava lá e em lugar nenhum mais: num
     * banco novo o `idDe` devolvia `undefined` e o teste quebrava no helper,
     * sem dizer que faltava fixture. Um teste de isolamento não pode depender
     * de dado ambiental — é justamente sobre não vazar entre ambientes.
     */
    const { provisionar } = await import("./provisionar");
    const outro = await provisionar({
      slug: `cliente-novo-${process.pid}`,
      nome: "Cliente Novo",
      email: `cliente-novo-${process.pid}@teste.local`,
      senha: "isolamento-de-teste",
    });
    ambientesCriados.push(outro.ambienteId);

    const ws = await materializar(outro.ambienteId).catch((e) => e as Error);
    // O cliente-novo tem um bloco só preenchido; materializa, mas com o vault
    // dele — não com o da Avanz.
    if (ws instanceof Error) {
      expect(ws.message).toMatch(/vault vazio/);
      return;
    }
    criados.push(ws);
    const manifest = parse(
      await readFile(path.join(ws.dir, "manifest.yaml"), "utf8"),
    );
    const textos = await Promise.all(
      manifest.target_company.always_load.map((r: string) =>
        readFile(path.join(ws.dir, r), "utf8"),
      ),
    );
    expect(textos.join("\n")).not.toContain("Mateus Leme");
  });
});
