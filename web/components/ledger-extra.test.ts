import { describe, expect, it } from "vitest";
import { textoDoExtra } from "./ledger-client";

describe("o campo extra do ledger", () => {
  it("mostra o conteúdo de um array de objetos", () => {
    /**
     * O caso que motivou isto: uma varredura de 42 minutos recusada na
     * ingestão, e a única linha que dizia por quê apareceu na tela como
     * `[object Object]`. O registro estava certo; a exibição é que jogava fora.
     */
    const recusas = [
      { onde: "2026-W35-001", detalhe: "pilar inexistente no vault: bastidor" },
      { onde: "2026-W35-002", detalhe: "sem headline" },
    ];
    const texto = textoDoExtra(recusas);
    expect(texto).not.toContain("[object Object]");
    expect(texto).toContain("pilar inexistente no vault: bastidor");
    expect(texto).toContain("sem headline");
  });

  it("array de primitivos continua legível", () => {
    expect(textoDoExtra(["trends", "local"])).toBe("trends  ·  local");
  });

  it("objeto solto vira JSON, não marcador", () => {
    expect(textoDoExtra({ estagio: "redacao" })).toBe('{"estagio":"redacao"}');
  });

  it("primitivos passam direto", () => {
    expect(textoDoExtra(42.3)).toBe("42.3");
    expect(textoDoExtra("ingestão recusada")).toBe("ingestão recusada");
    expect(textoDoExtra(null)).toBe("null");
  });
});
