import { describe, expect, it } from "vitest";
import { parseFrontmatter, patchFields } from "./frontmatter";

/**
 * O editor grava o formulário inteiro a cada salvamento. O que se exige daqui é
 * que o arquivo mude só onde o conteúdo mudou — antes, uma edição de headline
 * chegava como diff de frontmatter inteiro, e a headline saía dobrada em 80
 * colunas.
 */

const BRIEF = `---
brief_id: 2026-W99-001
slug: 2026-W99-001_teste
pillar: "6-mercado-rmbh"
headline: "Uma headline com dois pontos: por isso vem entre aspas"
hook: Hook simples sem aspas
caption_draft: |
  Primeiro parágrafo do rascunho.

  Segundo parágrafo, depois de uma linha em branco.
hashtags: [avanzimoveis, rmbh, mateusleme]
visual_brief:
  base_template: post-mes
  must_have:
    - "logo Avanz no canto inferior direito"
    - "paleta oficial #0F172A"
hero_choice: null
---

Corpo do documento, fora do frontmatter.
`;

function campos(raw: string) {
  const { data } = parseFrontmatter(raw);
  return data;
}

describe("patchFields", () => {
  it("não toca em nada quando nenhum valor mudou", () => {
    const data = campos(BRIEF);
    const saida = patchFields(BRIEF, {
      headline: data.headline,
      hook: data.hook,
      caption_draft: data.caption_draft,
      hashtags: data.hashtags,
      visual_brief: data.visual_brief,
    });
    expect(saida).toBe(BRIEF);
  });

  it("muda só a linha do campo editado", () => {
    const data = campos(BRIEF);
    const saida = patchFields(BRIEF, { ...data, hook: "Hook novo" });

    const antes = BRIEF.split("\n");
    const depois = saida.split("\n");
    expect(depois.length).toBe(antes.length);
    const mudadas = antes
      .map((l, i) => (l === depois[i] ? null : i))
      .filter((i) => i !== null);
    expect(mudadas).toHaveLength(1);
    expect(depois[mudadas[0]!]).toBe("hook: Hook novo");
  });

  it("não dobra string longa em 80 colunas", () => {
    const longa =
      "Uma headline deliberadamente longa, com mais de cento e vinte caracteres, " +
      "para provar que o emissor não quebra a linha no meio do valor";
    const saida = patchFields(BRIEF, { headline: longa });

    const linha = saida.split("\n").find((l) => l.startsWith("headline:"))!;
    expect(linha).toContain("no meio do valor");
    // A regressão que isto trava: valor partido em duas linhas, que um parser
    // linha-a-linha lê pela metade.
    expect(parseFrontmatter(saida).data.headline).toBe(longa);
  });

  it("preserva as aspas de quem tinha aspas, e a ausência de quem não tinha", () => {
    const saida = patchFields(BRIEF, {
      headline: "Outra headline: com dois pontos",
      hook: "Outro hook",
    });
    expect(saida).toContain('headline: "Outra headline: com dois pontos"');
    expect(saida).toContain("hook: Outro hook");
  });

  it("preserva bloco literal em texto multilinha", () => {
    const saida = patchFields(BRIEF, {
      caption_draft: "Novo primeiro parágrafo.\n\nNovo segundo parágrafo.",
    });
    // `|-` e não `|` porque o texto novo não termina em quebra de linha; o que
    // importa é continuar sendo bloco literal, e não `>`, que reembrulha.
    expect(saida).toContain("caption_draft: |-");
    expect(saida).not.toContain("caption_draft: >");
    expect(parseFrontmatter(saida).data.caption_draft).toBe(
      "Novo primeiro parágrafo.\n\nNovo segundo parágrafo.",
    );
  });

  it("mantém sequência em fluxo, como o Prettier formata o store", () => {
    const saida = patchFields(BRIEF, {
      hashtags: ["avanzimoveis", "esmeraldas"],
    });
    expect(saida).toContain("hashtags: [avanzimoveis, esmeraldas]");
  });

  it("quebra a sequência em fluxo quando ela passa de 80 colunas", () => {
    const muitas = Array.from(
      { length: 12 },
      (_, i) => `hashtagbemcomprida${i}`,
    );
    const saida = patchFields(BRIEF, { hashtags: muitas });
    expect(saida).toContain("hashtags:\n  [\n");
    expect(saida).toContain("    hashtagbemcomprida0,\n");
    expect(parseFrontmatter(saida).data.hashtags).toEqual(muitas);
  });

  it("acrescenta campo ausente em vez de falhar", () => {
    const saida = patchFields(BRIEF, { suggested_slot: "2026-W27-terca" });
    expect(parseFrontmatter(saida).data.suggested_slot).toBe("2026-W27-terca");
    expect(saida).toContain("hero_choice: null");
  });

  it("o corpo do documento nunca é tocado", () => {
    const saida = patchFields(BRIEF, { headline: "Qualquer outra" });
    expect(parseFrontmatter(saida).body).toBe(parseFrontmatter(BRIEF).body);
  });
});
