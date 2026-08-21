import { describe, expect, it } from "vitest";
import { normalizarHeadline, topicHash } from "./topico";

/**
 * O hash existe para uma coisa só: dois briefs sobre o mesmo assunto têm de
 * cair no mesmo valor, e sobre assuntos diferentes não. Tudo aqui é isso.
 */

describe("normalização da headline", () => {
  it("ignora acento, caixa e pontuação", () => {
    // Sem isto, "Crédito" e "credito" seriam assuntos diferentes.
    expect(normalizarHeadline("Selic a 14% encarece o CRÉDITO!")).toBe(
      normalizarHeadline("selic 14 encarece credito"),
    );
  });

  it("descarta stopwords, preserva palavra de conteúdo", () => {
    expect(normalizarHeadline("O crédito para a família")).toBe(
      "credito familia",
    );
  });

  it("descarta stopword acentuada, que a lista escreve com acento", () => {
    // A normalização tira o acento antes de filtrar. Uma lista acentuada
    // comparada com texto desacentuado nunca casa — parece certa e não faz
    // nada. Foi assim que a primeira versão saiu.
    expect(normalizarHeadline("Crédito até dezembro")).toBe("credito dezembro");
    expect(normalizarHeadline("Não é sobre preço")).toBe("preco");
  });

  it("não colapsa headlines que dizem coisas diferentes", () => {
    // O oposto do primeiro teste, e igualmente necessário: normalizar demais
    // faria a anti-repetição descartar pauta legítima.
    expect(topicHash("Selic encarece o crédito")).not.toBe(
      topicHash("Selic favorece o investidor"),
    );
  });

  it("trunca em 200 caracteres", () => {
    const longa = Array.from({ length: 80 }, (_, i) => `palavra${i}`).join(" ");
    expect(normalizarHeadline(longa).length).toBeLessThanOrEqual(200);
  });
});

describe("topic hash", () => {
  it("tem a forma que a spec exige", () => {
    expect(topicHash("Uma headline qualquer")).toMatch(/^[a-f0-9]{40}$/);
  });

  it("é estável entre chamadas", () => {
    // A anti-repetição compara valores gravados em momentos diferentes; hash
    // instável faria toda comparação falhar sem erro nenhum.
    const h = "MCMV: Faixa 1 saltou de 13% para 38,6%";
    expect(topicHash(h)).toBe(topicHash(h));
  });

  it("bate com o SHA1 da string normalizada", () => {
    // Conferido fora do código testado:
    //   printf '%s' 'credito familia' | sha1sum
    expect(topicHash("O crédito para a família")).toBe(
      "fa198f4a37814008a29ea04101f437e06c272868",
    );
  });
});
