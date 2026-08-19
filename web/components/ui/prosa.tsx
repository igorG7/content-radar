import type { ReactNode } from "react";

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

    if (linhas[0].startsWith("## ")) {
      return [
        <h3 className="h3 prosa-titulo" key={`${key}-h`}>
          {linhas[0].slice(3)}
        </h3>,
        ...(linhas.length > 1
          ? blocos(linhas.slice(1).join("\n"), `${key}-r`)
          : []),
      ];
    }
    if (linhas.every((l) => /^- /.test(l))) {
      return [
        <ul className="prosa-lista" key={key}>
          {linhas.map((l, li) => (
            <li key={`${key}-${li}`}>{inline(l.slice(2), `${key}-${li}`)}</li>
          ))}
        </ul>,
      ];
    }
    if (linhas.every((l) => /^\d+\. /.test(l))) {
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
  });
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
