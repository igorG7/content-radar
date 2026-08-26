import { describe, expect, it } from "vitest";
import { celulas, ehTabela } from "./tabela-markdown";

/** A resposta real do agente quando se pergunta quais escopos existem. */
const DO_AGENTE = [
  "| Slug | Nome | Pilares que alimenta | Fontes |",
  "|---|---|---|---|",
  "| `local` | Notícias locais RMBH | mercado-rmbh | 10 |",
  "| `trends` | Tendências do mercado | mercado-rmbh, decisao-inteligente | 5 |",
];

describe("tabela de markdown na prosa", () => {
  it("reconhece a tabela que o agente escreve", () => {
    expect(ehTabela(DO_AGENTE)).toBe(true);
  });

  it("recorta as células sem os vazios das bordas", () => {
    // O `|` inicial e o final produziriam uma célula vazia de cada lado.
    expect(celulas(DO_AGENTE[0])).toEqual([
      "Slug",
      "Nome",
      "Pilares que alimenta",
      "Fontes",
    ]);
    expect(celulas(DO_AGENTE[2])).toHaveLength(4);
  });

  it("não confunde prosa com barra vertical", () => {
    // Exigir só os pipes transformaria uma frase em grade de uma coluna.
    expect(ehTabela(["| isto é só um trecho com barra | mesmo |"])).toBe(false);
    expect(ehTabela(["| linha um |", "| linha dois |", "| linha três |"])).toBe(
      false,
    );
  });

  it("exige linha de dados, não só cabeçalho e separadora", () => {
    // Tabela vazia é ruído: renderizar a grade sem conteúdo promete dado que
    // não existe.
    expect(ehTabela(["| A | B |", "|---|---|"])).toBe(false);
  });

  it("aceita separadora com alinhamento e espaços", () => {
    // `|:---|---:|` e ` | --- | --- | ` são markdown válido.
    expect(ehTabela(["| A | B |", "|:---|---:|", "| 1 | 2 |"])).toBe(true);
    expect(ehTabela(["| A | B |", " | --- | --- | ", "| 1 | 2 |"])).toBe(true);
  });

  it("recusa separadora sem traço", () => {
    // `| | |` casaria numa checagem frouxa e viraria tabela sem ser.
    expect(ehTabela(["| A | B |", "|   |   |", "| 1 | 2 |"])).toBe(false);
  });

  it("preserva célula vazia no meio", () => {
    // Coluna sem valor é informação: colapsar mudaria o alinhamento da linha.
    expect(celulas("| a |  | c |")).toEqual(["a", "", "c"]);
  });
});
