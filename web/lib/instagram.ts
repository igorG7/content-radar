/**
 * A URL de um post publicado.
 *
 * Fica num módulo próprio, sem `server-only`, porque os dois lados precisam da
 * **mesma** regra: o formulário para avisar enquanto a pessoa digita, e a rota
 * para não aceitar o que o formulário recusaria. Antes só o cliente checava —
 * a API validava `z.string().url()`, então `https://exemplo.com` entrava por
 * qualquer caminho que não fosse a tela, e o brief ficava publicado apontando
 * para lugar nenhum.
 *
 * A URL não é enfeite: é a prova de que o ciclo fechou, é o que o acervo
 * mostra em "ver no Instagram", e é por ela que a anti-repetição sabe o que já
 * foi ao ar.
 */
export const URL_DE_POST =
  /^https?:\/\/(www\.)?instagram\.com\/(p|reel)\/[A-Za-z0-9_-]{5,}\/?(\?.*)?$/;

export function ehUrlDePost(valor: string): boolean {
  return URL_DE_POST.test(valor.trim());
}
