/**
 * Transforma o nome da empresa em slug.
 *
 * O slug vira prefixo de mídia e aparece em caminho, então precisa sobreviver a
 * sistema de arquivos e URL: sem acento, sem espaço, sem maiúscula. Nomes
 * brasileiros trazem acento com frequência — "Avanz Imóveis" tem de virar
 * `avanz-imoveis`, e não `avanz-im-veis`, que é o que sai se a remoção de
 * acento não vier antes do descarte de caractere estranho.
 *
 * Fica fora de `cadastro.ts` de propósito: aquele módulo é `server-only`, e a
 * tela de cadastro mostra a prévia do slug enquanto a pessoa digita. Uma cópia
 * no cliente divergiria da do servidor sem ninguém perceber, e a prévia passaria
 * a mentir sobre o endereço que o ambiente vai receber.
 */
export function slugDoNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}
