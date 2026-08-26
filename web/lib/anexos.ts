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
export function avaliar(arquivo: {
  name: string;
  size: number;
}): Recusa | null {
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

/** O anexo enquanto ainda está no navegador, antes de subir. */
export interface AnexoLocal {
  id: string;
  nome: string;
  tamanho: number;
  mime: string;
  url: string | null;
  arquivo?: File;
}

/**
 * Decide o que entra na lista e o que é recusado, de uma vez.
 *
 * Ficava dentro do componente, com as recusas sendo colhidas **dentro** do
 * updater do `setState` e lidas **fora** dele — e o React só roda o updater
 * depois. A lista de recusas estava sempre vazia na hora de exibir, então
 * arquivo rejeitado sumia sem chip e sem motivo: a tela não dizia nada, e
 * "não anexou" era tudo que dava para saber.
 *
 * Função pura resolve a ordem e, de quebra, fica testável sem navegador.
 */
export function acrescentar(
  atual: AnexoLocal[],
  arquivos: File[],
): { anexos: AnexoLocal[]; recusados: string[] } {
  const anexos = [...atual];
  const recusados: string[] = [];

  for (const f of arquivos) {
    if (anexos.length >= MAX_ARQUIVOS) {
      recusados.push(`${f.name} — limite de ${MAX_ARQUIVOS} arquivos`);
      continue;
    }
    const recusa = avaliar(f);
    if (recusa) {
      recusados.push(`${recusa.nome} — ${recusa.motivo}`);
      continue;
    }
    if (anexos.some((a) => a.nome === f.name && a.tamanho === f.size)) {
      recusados.push(`${f.name} — já anexado`);
      continue;
    }
    anexos.push({
      id: `${f.name}-${f.size}-${anexos.length}`,
      nome: f.name,
      tamanho: f.size,
      mime: f.type || "",
      url: null,
      arquivo: f,
    });
  }

  return { anexos, recusados };
}
