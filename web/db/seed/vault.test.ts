import { describe, expect, it } from "vitest";
import { extrairGuardrails } from "./vault";

/**
 * O bloco de guardrails do vault é markdown escrito por gente: a linha quebra
 * onde couber, e a continuação vem indentada. Ler só a primeira linha física
 * cortava a regra no meio — e uma regra pela metade não é regra.
 */

const BLOCO = `### Restrições
- \`nao-prometer-aprovacao\` — nunca prometer aprovação garantida de crédito ou
  financiamento
- \`nao-inventar-imovel\` — nunca inventar informação sobre um imóvel: metragem,
  documentação, valor, disponibilidade
- \`nao-sair-do-escopo\` — não sair do escopo imobiliário

### Condução
- entender o perfil antes de sugerir opção
`;

describe("guardrails do vault", () => {
  it("junta a continuação indentada em vez de cortar a frase", () => {
    const g = extrairGuardrails(BLOCO);
    expect(g[0].corpo).toBe(
      "nunca prometer aprovação garantida de crédito ou financiamento",
    );
    expect(g[1].corpo).toBe(
      "nunca inventar informação sobre um imóvel: metragem, documentação, valor, disponibilidade",
    );
  });

  it("mantém intacto o item que cabe numa linha só", () => {
    expect(extrairGuardrails(BLOCO)[2].corpo).toBe(
      "não sair do escopo imobiliário",
    );
  });

  it("ignora o que não tem slug — só restrição vira regra", () => {
    // A seção "Condução" é orientação de atendimento, não restrição de marca:
    // os itens dela não têm slug e não devem virar linha na tabela.
    expect(extrairGuardrails(BLOCO).map((g) => g.slug)).toEqual([
      "nao-prometer-aprovacao",
      "nao-inventar-imovel",
      "nao-sair-do-escopo",
    ]);
  });

  it("recusa um bloco sem restrição nenhuma", () => {
    expect(() => extrairGuardrails("### Condução\n- só isso")).toThrow();
  });
});
