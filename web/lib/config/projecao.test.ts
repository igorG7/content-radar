import { describe, expect, it } from "vitest";
import { projetarConfig } from "./projecao";
import type { Manifest } from "@/lib/manifest";

/**
 * O manifest é um arquivo só; a configuração é por cliente. Sem a projeção, a
 * pessoa mudava a meta de 10 para 5, o banco gravava 5, e o painel seguia
 * anunciando 10 — porque lia o arquivo.
 */
const base = {
  funnel: { candidates_per_week_target: 10, posts_por_semana: 4 },
  anti_repetition: {
    match_score_min: 0.55,
    match_score_weights: { pillar_fit: 0.3, icp_fit: 0.15 },
    match_score_caps: { icp_ambiguo: 0.45 },
    windows: { same_topic_days: 90 },
  },
} as unknown as Manifest;

const vazia = { pesos: {}, caps: {}, janelas: {}, volume: {} };

describe("configuração do ambiente sobre o manifest", () => {
  it("a meta editada é a que o painel lê", () => {
    const m = projetarConfig(base, {
      ...vazia,
      volume: { candidates_per_week_target: 5 },
    });
    expect(m.funnel.candidates_per_week_target).toBe(5);
  });

  it("não mexe no que o ambiente não configurou", () => {
    const m = projetarConfig(base, {
      ...vazia,
      volume: { candidates_per_week_target: 5 },
    });
    expect(
      (m.funnel as unknown as Record<string, unknown>).posts_por_semana,
    ).toBe(4);
  });

  it("não altera o manifest original", () => {
    // Mutar o objeto do `loadManifest` faria a projeção de um cliente vazar
    // para o próximo que lesse o mesmo cache.
    projetarConfig(base, {
      ...vazia,
      volume: { candidates_per_week_target: 1 },
    });
    expect(base.funnel.candidates_per_week_target).toBe(10);
  });

  it("peso e janela vão para os seus lugares", () => {
    const m = projetarConfig(base, {
      ...vazia,
      pesos: { pillar_fit: 0.4 },
      janelas: { same_topic_days: 14 },
    }) as unknown as Record<string, Record<string, Record<string, unknown>>>;
    expect(m.anti_repetition.match_score_weights.pillar_fit).toBe(0.4);
    expect(m.anti_repetition.windows.same_topic_days).toBe(14);
  });

  it("cap vai onde o manifest já tem a chave", () => {
    /**
     * Ambíguo na volta: o mesmo grupo `caps` recebe tanto
     * `anti_repetition.match_score_caps.X` quanto `anti_repetition.X`. Quem
     * desempata é o manifest — a chave vai onde já existe.
     */
    const m = projetarConfig(base, {
      ...vazia,
      caps: { icp_ambiguo: 0.2, match_score_min: 0.7 },
    }) as unknown as Record<string, Record<string, unknown>>;
    expect(
      (m.anti_repetition.match_score_caps as Record<string, unknown>)
        .icp_ambiguo,
    ).toBe(0.2);
    expect(m.anti_repetition.match_score_min).toBe(0.7);
  });

  it("chave que não existe no manifest é descartada", () => {
    // Inventar caminho criaria configuração que nenhuma skill lê.
    const m = projetarConfig(base, {
      ...vazia,
      caps: { inventada: 1 },
    }) as unknown as Record<string, Record<string, unknown>>;
    expect("inventada" in m.anti_repetition).toBe(false);
  });
});
