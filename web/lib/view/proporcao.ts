/**
 * Qual enquadramento a peça leva — uma regra, um lugar.
 *
 * Ela é consultada em dois momentos distantes: quando o pacote é gerado e
 * quando a tela mostra o brief. Escrita duas vezes, divergiria — e o sintoma
 * seria a tela dizer 1:1 enquanto o `.md` que a pessoa leva ao Smart Design diz
 * outra coisa.
 */

/**
 * O padrão do produto, quando ninguém declarou — nem a pessoa, nem o pilar.
 *
 * Vertical: o feed do Instagram dá mais altura de tela a 3:4 que a 1:1, e o
 * pacote precisa dizer algo a quem vai fazer a arte.
 *
 * O custo de existir: um cliente que nunca configurou nada vê 3:4 como se fosse
 * escolha dele. A alternativa era omitir o formato — e omitir devolvia a
 * escolha ao briefer, que inventava uma proporção por brief (dois do mesmo
 * pilar saíram 3:4 e 1:1 na mesma varredura).
 */
export const PROPORCAO_PADRAO = "3:4";

/**
 * Do mais específico ao mais geral.
 *
 * O brief primeiro porque `aspect_ratio` só existe ali se **uma pessoa** o
 * escreveu: a ingestão descarta o que o briefer devolve. A ordem já foi
 * inversa, e nos pilares com template isso tornava o campo da tela de edição
 * decorativo — a pessoa mudava e o pacote ignorava.
 */
export function proporcaoEfetiva(
  doBrief: string | null | undefined,
  doPilar: string | null | undefined,
): string {
  return doBrief?.trim() || doPilar?.trim() || PROPORCAO_PADRAO;
}
