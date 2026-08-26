import { describe, expect, it } from "vitest";
import { PROPORCAO_PADRAO, proporcaoEfetiva } from "./proporcao";

/**
 * A regra é consultada em dois momentos distantes — quando o pacote é gerado e
 * quando a tela mostra o brief. Escrita duas vezes divergiria, e o sintoma
 * seria a tela dizer uma coisa e o `.md` levado ao Smart Design dizer outra.
 */
describe("qual enquadramento a peça leva", () => {
  it("o do brief vence o do pilar", () => {
    // A ordem já foi inversa, e nos pilares com template isso tornava o campo
    // da tela de edição decorativo: a pessoa mudava e o pacote ignorava.
    expect(proporcaoEfetiva("9:16", "1:1")).toBe("9:16");
  });

  it("sem valor no brief, vale o do pilar", () => {
    // É onde a marca declara. O brief só carrega proporção quando alguém a
    // editou — a ingestão descarta a que o briefer inventa.
    expect(proporcaoEfetiva(null, "1:1")).toBe("1:1");
    expect(proporcaoEfetiva(undefined, "4:5")).toBe("4:5");
  });

  it("sem nenhum dos dois, o padrão do produto", () => {
    // Três dos seis pilares da Avanz não têm template. Omitir devolvia a
    // escolha ao briefer, que inventava uma por brief.
    expect(proporcaoEfetiva(null, null)).toBe(PROPORCAO_PADRAO);
    expect(PROPORCAO_PADRAO).toBe("3:4");
  });

  it("string vazia não conta como declaração", () => {
    // O campo da tela devolve "" quando ninguém escolheu, e "" não é escolha.
    expect(proporcaoEfetiva("", "1:1")).toBe("1:1");
    expect(proporcaoEfetiva("   ", null)).toBe(PROPORCAO_PADRAO);
  });
});
