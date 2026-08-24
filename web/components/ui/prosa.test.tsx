import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProsaInline } from "./prosa";

/**
 * Renderiza de verdade, sem navegador: `renderToStaticMarkup` basta para
 * afirmar que a gramática vira os elementos certos. Sem isto, "a tabela
 * aparece" seria dedução a partir do parser — e o parser estar certo não prova
 * que o componente escolhe o ramo certo.
 */
const html = (texto: string) =>
  renderToStaticMarkup(<ProsaInline texto={texto} />);

const RESPOSTA_DO_AGENTE = `5 escopos, todos ativos:

| Slug | Nome | Pilares que alimenta | Fontes |
|---|---|---|---|
| \`local\` | Notícias locais RMBH | mercado-rmbh | 10 |
| \`trends\` | Tendências do mercado | mercado-rmbh, decisao-inteligente | 5 |

Nenhuma fonte desativada em nenhum deles.`;

describe("prosa do chat", () => {
  it("a tabela do agente vira tabela, não parágrafo com pipes", () => {
    const saida = html(RESPOSTA_DO_AGENTE);
    expect(saida).toContain("<table");
    expect(saida).toContain("<thead");
    // Quatro colunas no cabeçalho, duas linhas de dados. O delimitador em
    // `<th[ >]` é necessário: `/<th/` casaria com `<thead` e contaria cinco.
    expect(saida.match(/<th[ >]/g)).toHaveLength(4);
    expect(saida.match(/<tr/g)).toHaveLength(3);
    // E o separador não sobra como texto na tela.
    expect(saida).not.toContain("|---|");
  });

  it("o texto em volta continua parágrafo", () => {
    const saida = html(RESPOSTA_DO_AGENTE);
    expect(saida).toContain("5 escopos, todos ativos:");
    expect(saida).toContain("Nenhuma fonte desativada");
  });

  it("crase dentro da célula vira código, como no resto da prosa", () => {
    // A mesma gramática inline vale dentro da tabela: `local` é endereço.
    expect(html(RESPOSTA_DO_AGENTE)).toContain(
      '<code class="cod">local</code>',
    );
  });

  it("prosa com barra vertical não vira tabela", () => {
    const saida = html("Use o formato `a | b` quando precisar.");
    expect(saida).not.toContain("<table");
  });

  it("lista e negrito continuam funcionando", () => {
    const saida = html("- item **um**\n- item dois");
    expect(saida).toContain("<ul");
    expect(saida).toContain("<strong>um</strong>");
  });
});
