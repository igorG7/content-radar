import { describe, expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { RADAR_ROOT } from "./manifest";

/**
 * Amarra a instrução de um subagente às ferramentas que ele tem.
 *
 * A `scan-007` abortou no estágio 1 porque o pesquisador devolveu `image_url`
 * onde o contrato exige `image_candidates[]`. A culpa não era dele: a definição
 * mandava seguir "o schema da §4 da spec 002" e as ferramentas dele são
 * `[WebSearch, WebFetch]` — sem `Read`, sem como abrir a spec. Seis dos campos
 * exigidos não apareciam uma única vez na definição. Ele inventou os nomes
 * plausíveis, que é a única coisa que dava para fazer.
 *
 * Custou 8 minutos e cerca de três dólares para descobrir isso em execução.
 */

const DIR = path.join(RADAR_ROOT, ".claude", "agents");

async function definicoes() {
  const nomes = (await readdir(DIR)).filter((n) => n.endsWith(".md"));
  return Promise.all(
    nomes.map(async (nome) => {
      const bruto = await readFile(path.join(DIR, nome), "utf8");
      const fm = bruto.match(/^---\n([\s\S]*?)\n---/);
      const meta = fm ? (parse(fm[1]) as { tools?: unknown }) : {};
      const tools = Array.isArray(meta.tools) ? meta.tools.map(String) : [];
      return { nome, corpo: bruto, tools };
    }),
  );
}

/** O que a spec 002 §4 exige em cada finding e em `meta`. */
const CONTRATO_DO_PESQUISADOR = [
  "finding_id",
  "url",
  "title",
  "summary",
  "published_at",
  "fetched_at",
  "source_key",
  "source_domain",
  "scope",
  "language",
  "content_type",
  "image_candidates",
  "geo_hints",
  "raw_excerpts",
  "relevance_hint",
  "total_searched",
  "total_returned",
  "total_skipped",
  "skipped_reasons",
  "executed_at",
];

describe("definição dos subagentes", () => {
  it("agente sem Read não é mandado consultar arquivo", async () => {
    // Apontar para uma spec é legítimo — desde que o agente consiga abri-la.
    for (const a of await definicoes()) {
      if (a.tools.includes("Read")) continue;
      const aponta = /docs\/specs|spec 0\d\d|schema da §/.test(a.corpo);
      expect(
        aponta,
        `${a.nome} não tem Read mas manda consultar arquivo — ele não consegue, e vai inventar`,
      ).toBe(false);
    }
  });

  it("o pesquisador nomeia todo campo que o contrato exige", async () => {
    // Sem Read, o que não estiver escrito aqui ele não tem como saber.
    const pesquisador = (await definicoes()).find(
      (a) => a.nome === "market-researcher.md",
    );
    expect(pesquisador).toBeDefined();

    const ausentes = CONTRATO_DO_PESQUISADOR.filter(
      (campo) => !pesquisador!.corpo.includes(campo),
    );
    expect(ausentes, "campos que o agente teria de adivinhar").toEqual([]);
  });

  it("todo agente declara as ferramentas que usa", async () => {
    // Sem `tools` o agente herda tudo, e o teste acima deixa de valer.
    for (const a of await definicoes()) {
      expect(a.tools.length, `${a.nome} não declara tools`).toBeGreaterThan(0);
    }
  });
});
