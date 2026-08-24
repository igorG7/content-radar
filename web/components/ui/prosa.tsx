import type { ReactNode } from "react";
import { celulas, ehTabela } from "@/lib/view/tabela-markdown";

/**
 * Markdown enxuto — o suficiente para a prosa dos blocos do vault e para as
 * respostas do agente. Código em crase vira endereço: é por ele que a
 * configuração aponta, então precisa ler como endereço e não como ênfase.
 */
function inline(texto: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const padrao = /`([^`]+)`|\*\*([^*]+)\*\*/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = padrao.exec(texto)) !== null) {
    if (match.index > cursor) nodes.push(texto.slice(cursor, match.index));
    if (match[1] !== undefined) {
      nodes.push(
        <code className="cod" key={`${keyBase}-c${i}`}>
          {match[1]}
        </code>,
      );
    } else {
      nodes.push(<strong key={`${keyBase}-b${i}`}>{match[2]}</strong>);
    }
    cursor = match.index + match[0].length;
    i++;
  }
  if (cursor < texto.length) nodes.push(texto.slice(cursor));
  return nodes;
}

function blocos(texto: string, keyBase: string): ReactNode[] {
  return texto.split("\n\n").flatMap((bloco, bi) => {
    const linhas = bloco.split("\n").filter((l) => l.trim());
    if (linhas.length === 0) return [];
    const key = `${keyBase}-${bi}`;

    /**
     * Tabela — o agente responde com ela sempre que a pergunta é "quais são",
     * e sem isto o bloco caía no ramo de parágrafo: a pessoa via os pipes
     * crus, uma linha embaixo da outra, e tinha de ler a grade de cabeça.
     *
     * O reconhecimento exige a linha separadora (`|---|---|`), não só pipes:
     * prosa com barra vertical no meio não vira tabela por acidente.
     */
    if (ehTabela(linhas)) {
      const [cabecalho, , ...corpo] = linhas;
      return [
        // A rolagem é da tabela, não da página: coluna larga não pode empurrar
        // a conversa inteira para o lado.
        <div className="prosa-tabela-rolagem" key={`${key}-w`}>
          <table className="prosa-tabela">
            <thead>
              <tr>
                {celulas(cabecalho).map((c, ci) => (
                  <th key={`${key}-h${ci}`}>{inline(c, `${key}-h${ci}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corpo.map((linha, li) => (
                <tr key={`${key}-r${li}`}>
                  {celulas(linha).map((c, ci) => (
                    <td key={`${key}-r${li}c${ci}`}>
                      {inline(c, `${key}-r${li}c${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      ];
    }
    /**
     * Segmenta o bloco em corridas do mesmo tipo, em vez de exigir que ele
     * inteiro seja de um tipo só.
     *
     * A regra anterior pedia que **toda** linha fosse item para virar lista. O
     * agente escreve "No radar:" e emenda os itens logo abaixo, sem linha em
     * branco — o `every` reprovava e o bloco caía em parágrafo, com os hífens
     * aparecendo crus na tela. É a forma mais comum de lista que existe.
     */
    return corridas(linhas).flatMap((corrida, ci) =>
      renderizar(corrida, `${key}-${ci}`),
    );
  });
}

type Tipo = "titulo" | "lista" | "numerada" | "paragrafo";

function tipoDa(linha: string): Tipo {
  if (linha.startsWith("## ")) return "titulo";
  if (/^- /.test(linha)) return "lista";
  if (/^\d+\. /.test(linha)) return "numerada";
  return "paragrafo";
}

/** Agrupa linhas vizinhas do mesmo tipo. Título fica sempre sozinho. */
function corridas(linhas: string[]): { tipo: Tipo; linhas: string[] }[] {
  const saida: { tipo: Tipo; linhas: string[] }[] = [];
  for (const linha of linhas) {
    const tipo = tipoDa(linha);
    const ultima = saida.at(-1);
    if (ultima && ultima.tipo === tipo && tipo !== "titulo") {
      ultima.linhas.push(linha);
    } else {
      saida.push({ tipo, linhas: [linha] });
    }
  }
  return saida;
}

function renderizar(
  corrida: { tipo: Tipo; linhas: string[] },
  key: string,
): ReactNode[] {
  const { tipo, linhas } = corrida;

  if (tipo === "titulo") {
    return [
      <h3 className="h3 prosa-titulo" key={`${key}-h`}>
        {linhas[0].slice(3)}
      </h3>,
    ];
  }
  if (tipo === "lista") {
    return [
      <ul className="prosa-lista" key={key}>
        {linhas.map((l, li) => (
          <li key={`${key}-${li}`}>{inline(l.slice(2), `${key}-${li}`)}</li>
        ))}
      </ul>,
    ];
  }
  if (tipo === "numerada") {
    return [
      <ol className="prosa-lista is-num" key={key}>
        {linhas.map((l, li) => (
          <li key={`${key}-${li}`}>
            {inline(l.replace(/^\d+\. /, ""), `${key}-${li}`)}
          </li>
        ))}
      </ol>,
    ];
  }
  return [
    <p key={key}>
      {linhas.map((l, li) => (
        <span key={`${key}-${li}`}>
          {li > 0 && <br />}
          {inline(l, `${key}-${li}`)}
        </span>
      ))}
    </p>,
  ];
}

export function Prosa({
  texto,
  className = "prosa",
}: {
  texto: string;
  className?: string;
}) {
  return <div className={className}>{blocos(texto, "p")}</div>;
}

/** Mesma gramática, sem a caixa de leitura — usada dentro das bolhas do chat. */
export function ProsaInline({ texto }: { texto: string }) {
  return <>{blocos(texto, "i")}</>;
}
