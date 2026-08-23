import { describe, expect, it } from "vitest";
import { slugDoNome } from "./slug";

/**
 * O slug vira prefixo de mídia e parte de caminho. Errar aqui não dá erro: dá
 * ambiente com endereço estranho, descoberto meses depois num caminho de
 * arquivo.
 */
describe("slug a partir do nome da empresa", () => {
  it("tira acento em vez de descartar a letra", () => {
    // Descartar daria `avanz-im-veis`. A ordem — desacentuar antes de filtrar —
    // é o que separa as duas coisas.
    expect(slugDoNome("Avanz Imóveis")).toBe("avanz-imoveis");
    expect(slugDoNome("Construções Araújo")).toBe("construcoes-araujo");
  });

  it("colapsa pontuação e espaço em um traço só", () => {
    expect(slugDoNome("Silva  &  Filhos Ltda.")).toBe("silva-filhos-ltda");
  });

  it("não deixa traço sobrando na ponta", () => {
    // `slice` no meio de um traço deixaria o slug terminando nele.
    expect(slugDoNome("  Imobiliária  ")).toBe("imobiliaria");
    expect(slugDoNome("!!! Alfa !!!")).toBe("alfa");
  });

  it("corta nome longo sem terminar em traço", () => {
    const longo = `${"a".repeat(47)} beta`;
    const slug = slugDoNome(longo);
    expect(slug.length).toBeLessThanOrEqual(48);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("devolve vazio quando não sobra nada aproveitável", () => {
    // Quem chama trata isso como recusa: sem letra nem número não há endereço.
    expect(slugDoNome("!!!")).toBe("");
    expect(slugDoNome("   ")).toBe("");
  });

  it("preserva número, que faz parte de muito nome de empresa", () => {
    expect(slugDoNome("Grupo 3R")).toBe("grupo-3r");
  });
});
