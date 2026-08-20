import { describe, expect, it } from "vitest";
import { linhasDeEstagio } from "./estagios";

/**
 * A regra que a primeira versão errou. Cada teste aqui corresponde a algo que
 * a tela mostrou errado durante uma execução real.
 */

const pesquisa = { estagio: "pesquisa", minuto: 1.5, extra: { achados: 9 } };
const filtragem = { estagio: "filtragem", minuto: 13.9, extra: {} };
const redacao = { estagio: "redacao", minuto: 20.2, extra: {} };

describe("linhas de estágio", () => {
  it("o estágio corrente não aparece como concluído", () => {
    // Foi o bug: o evento nasce quando o estágio começa, e a tela mostrou ✓
    // durante sete minutos de pesquisa em andamento.
    const [p] = linhasDeEstagio([pesquisa], "pesquisa");
    expect(p.situacao).toBe("corrente");
  });

  it("um estágio só conclui quando outro assume", () => {
    const [p, f] = linhasDeEstagio([pesquisa, filtragem], "filtragem");
    expect(p.situacao).toBe("concluido");
    expect(f.situacao).toBe("corrente");
  });

  it("o que ainda não começou fica pendente", () => {
    const [, , r] = linhasDeEstagio([pesquisa], "pesquisa");
    expect(r.situacao).toBe("pendente");
    expect(r.entrouEm).toBeNull();
  });

  it("duração é o intervalo até o próximo, não o minuto de entrada", () => {
    // Mostrar 1,5 ao lado de "Pesquisa" seria lido como "levou um minuto e
    // meio", quando significa "começou aos 1,5".
    const [p, f] = linhasDeEstagio([pesquisa, filtragem, redacao], "redacao");
    expect(p.duracao).toBeCloseTo(12.4, 5);
    expect(f.duracao).toBeCloseTo(6.3, 5);
  });

  it("o corrente não tem duração — ainda não durou", () => {
    const [, f] = linhasDeEstagio([pesquisa, filtragem], "filtragem");
    expect(f.duracao).toBeNull();
    expect(f.entrouEm).toBe(13.9);
  });

  it("carrega a contagem parcial do estágio", () => {
    const [p] = linhasDeEstagio([pesquisa, filtragem], "filtragem");
    expect(p.extra).toEqual({ achados: 9 });
  });

  it("um scan ainda sem estágio nenhum mostra os três pendentes", () => {
    expect(linhasDeEstagio([], "rodando").map((l) => l.situacao)).toEqual([
      "pendente",
      "pendente",
      "pendente",
    ]);
  });
});
