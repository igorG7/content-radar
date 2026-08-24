/**
 * Reconhecer e recortar uma tabela de Markdown.
 *
 * Vive fora do componente porque é a parte com regra, e regra sem teste é onde
 * o falso positivo nasce: prosa com barra vertical no meio não pode virar
 * tabela por acidente, e uma tabela de verdade não pode deixar de ser
 * reconhecida por causa de espaço a mais.
 *
 * O agente responde com tabela sempre que a pergunta é "quais são" — escopos,
 * pilares, fontes. Sem isto o bloco caía no ramo de parágrafo e a pessoa via os
 * pipes crus, uma linha embaixo da outra.
 */

/** Células de uma linha, sem os vazios que as bordas produzem. */
export function celulas(linha: string): string[] {
  return linha
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => c.trim());
}

/**
 * Cabeçalho, separadora e ao menos uma linha de dados — nessa ordem.
 *
 * A separadora é o que distingue tabela de prosa: exigir só os pipes
 * transformaria "use `a | b`" numa grade de uma coluna.
 */
export function ehTabela(linhas: string[]): boolean {
  if (linhas.length < 3) return false;
  if (!linhas.every((l) => l.trim().startsWith("|"))) return false;
  return /^\s*\|[\s:|-]*-[\s:|-]*\|\s*$/.test(linhas[1]);
}
