/**
 * O que o chat aceita como anexo.
 *
 * Fica num módulo próprio, sem `server-only`, porque os dois lados precisam da
 * mesma regra: o seletor de arquivo para recusar antes de subir, e a rota para
 * não aceitar o que o seletor recusaria. Duas listas divergem — e a que
 * diverge para mais é a que deixa passar.
 *
 * Só texto por enquanto. O seletor anunciava PNG, JPEG, WebP e PDF, formatos
 * que nada no caminho sabia ler: a pessoa anexava um PDF e o agente respondia
 * que não tinha recebido nada. Anunciar o que não se entrega é o defeito, não
 * a lista curta.
 */

/** Extensões aceitas. `.docx` não entra: é zip com XML, e custa um parser. */
export const EXTENSOES = [
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".yaml",
  ".yml",
] as const;

/** O que vai no `accept` do input. */
export const ACCEPT = EXTENSOES.join(",");

/**
 * Um megabyte. Não é limite de banco — é limite de contexto: o conteúdo vai
 * inteiro para o agente quando ele lê o anexo, e um arquivo grande consome a
 * janela que a conversa precisa para o resto.
 */
export const LIMITE_BYTES = 1_000_000;

/** Quantos anexos por mensagem. */
export const MAX_ARQUIVOS = 5;

export type Recusa = { nome: string; motivo: string };

/**
 * Aceita ou recusa, com o motivo pronto para a tela.
 *
 * O tipo declarado pelo navegador não basta: `.md` costuma chegar como
 * `application/octet-stream` ou vazio. A extensão é o critério, e o tipo entra
 * só como reforço quando existe.
 */
export function avaliar(arquivo: { name: string; size: number }): Recusa | null {
  const nome = arquivo.name.toLowerCase();
  if (!EXTENSOES.some((e) => nome.endsWith(e))) {
    return {
      nome: arquivo.name,
      motivo: `só arquivo de texto por enquanto (${EXTENSOES.join(", ")})`,
    };
  }
  if (arquivo.size > LIMITE_BYTES) {
    return {
      nome: arquivo.name,
      motivo: `passa de ${Math.round(LIMITE_BYTES / 1000)} KB`,
    };
  }
  if (arquivo.size === 0) {
    return { nome: arquivo.name, motivo: "arquivo vazio" };
  }
  return null;
}
