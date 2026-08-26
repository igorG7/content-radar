/**
 * O cadastro público está aberto?
 *
 * **Fechado por padrão.** A variável precisa estar presente e valer `1` para
 * abrir — um deploy que esqueça de configurá-la nasce fechado, que é o erro
 * barato. O contrário, abrir por omissão, faz de cada servidor novo uma
 * torneira de ambientes até alguém perceber.
 *
 * A tela existe e está testada; o que se decide aqui é se ela atende. Enquanto
 * não houver confirmação de e-mail e limite de abuso, o lugar dela é fechada.
 */
export function cadastroAberto(): boolean {
  return process.env.CADASTRO_ABERTO === "1";
}
