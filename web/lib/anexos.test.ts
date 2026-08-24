import { describe, expect, it } from "vitest";
import { ACCEPT, EXTENSOES, LIMITE_BYTES, avaliar } from "./anexos";

/**
 * A mesma regra vale no seletor e na rota. Antes o seletor anunciava PNG, JPEG,
 * WebP e PDF — formatos que nada no caminho sabia ler —, e o resultado era
 * anexar um PDF e ouvir do agente que não tinha chegado nada.
 */
describe("o que o chat aceita como anexo", () => {
  it("aceita os formatos de texto", () => {
    for (const ext of EXTENSOES) {
      expect(avaliar({ name: `notas${ext}`, size: 100 })).toBeNull();
    }
  });

  it("recusa o que não sabe ler, dizendo o que aceita", () => {
    const r = avaliar({ name: "planta.pdf", size: 100 });
    expect(r).not.toBeNull();
    expect(r!.motivo).toContain(".txt");
  });

  it("recusa imagem — não é texto e não seria lida", () => {
    expect(avaliar({ name: "foto.png", size: 100 })).not.toBeNull();
  });

  it("recusa acima do limite", () => {
    // O limite é de contexto, não de banco: o conteúdo vai inteiro ao agente.
    expect(
      avaliar({ name: "grande.txt", size: LIMITE_BYTES + 1 }),
    ).not.toBeNull();
    expect(avaliar({ name: "no limite.txt", size: LIMITE_BYTES })).toBeNull();
  });

  it("recusa arquivo vazio", () => {
    // Subir zero byte gasta um turno do agente para dizer que não há nada.
    expect(avaliar({ name: "vazio.txt", size: 0 })).not.toBeNull();
  });

  it("não se importa com maiúscula na extensão", () => {
    expect(avaliar({ name: "NOTAS.TXT", size: 10 })).toBeNull();
  });

  it("o accept do seletor lista exatamente o que a regra aceita", () => {
    // Duas listas divergem, e a que diverge para mais é a que deixa passar.
    expect(ACCEPT.split(",").sort()).toEqual([...EXTENSOES].sort());
  });
});
