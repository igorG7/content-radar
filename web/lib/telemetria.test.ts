import { describe, expect, it } from "vitest";
import { linhasDeConsumo, totalDe, type UsoDeModelo } from "./telemetria";

const uso = (p: Partial<UsoDeModelo>): UsoDeModelo => ({
  inputTokens: 0,
  outputTokens: 0,
  cacheReadInputTokens: 0,
  cacheCreationInputTokens: 0,
  webSearchRequests: 0,
  costUSD: 0,
  ...p,
});

describe("consumo a partir do que o SDK devolve", () => {
  it("uma linha por modelo", () => {
    // Uma varredura passa por vários modelos: o laço principal, os subagentes,
    // e o que o SDK chama por dentro. Agregar esconde onde o dinheiro foi.
    const linhas = linhasDeConsumo({
      "claude-opus-5": uso({
        inputTokens: 100,
        outputTokens: 50,
        costUSD: 1.5,
      }),
      "claude-haiku-4-5": uso({ inputTokens: 900, costUSD: 0.02 }),
    });
    expect(linhas.map((l) => l.modelo).sort()).toEqual([
      "claude-haiku-4-5",
      "claude-opus-5",
    ]);
  });

  it("guarda o custo como string com seis casas", () => {
    // `numeric` volta do driver como string; passar por `number` no meio
    // introduz erro de ponto flutuante em algo que existe para ser somado.
    const [l] = linhasDeConsumo({
      m: uso({ costUSD: 0.1234567, inputTokens: 1 }),
    });
    expect(l.custoUsd).toBe("0.123457");
    expect(typeof l.custoUsd).toBe("string");
  });

  it("descarta modelo que não consumiu nada", () => {
    // O SDK lista modelo zerado quando a execução morre na partida. Guardar
    // isso encheria o detalhamento de linhas que não custaram nada.
    expect(linhasDeConsumo({ m: uso({ costUSD: 0 }) })).toHaveLength(0);
  });

  it("mantém modelo que só fez busca na web", () => {
    // Busca é cobrada por requisição, não por token: zero token não é zero
    // custo, e filtrar por token perderia justamente o gasto do pesquisador.
    expect(linhasDeConsumo({ m: uso({ webSearchRequests: 12 }) })).toHaveLength(
      1,
    );
  });

  it("sobrevive a ausência de modelUsage", () => {
    // Resultado de erro pode vir sem o campo. Isso não pode derrubar o scan.
    expect(linhasDeConsumo(undefined)).toEqual([]);
  });

  it("leva canonicalModel e provider para o extra", () => {
    const [l] = linhasDeConsumo({
      alias: uso({
        inputTokens: 1,
        canonicalModel: "claude-opus-5",
        provider: "firstParty",
      }),
    });
    expect(l.extra).toEqual({
      canonicalModel: "claude-opus-5",
      provider: "firstParty",
    });
  });

  it("soma cache junto dos tokens, e custo em número só na exibição", () => {
    const linhas = linhasDeConsumo({
      a: uso({ inputTokens: 10, outputTokens: 5, costUSD: 0.5 }),
      b: uso({
        cacheReadInputTokens: 100,
        cacheCreationInputTokens: 20,
        costUSD: 0.25,
      }),
    });
    const t = totalDe(linhas);
    expect(t.tokens).toBe(135);
    expect(t.custoUsd).toBeCloseTo(0.75, 6);
  });
});
