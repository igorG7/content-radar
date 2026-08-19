"use server";

import { revalidatePath } from "next/cache";
import { radarStore } from "@/lib/store";

export interface EstadoGravacao {
  erro?: string;
  gravadoEm?: string;
}

/**
 * Grava uma versão nova do bloco. O motivo é obrigatório e a interface não deve
 * contorná-lo: prosa não tem validação automática, então o histórico é a única
 * rede de segurança — e histórico sem o porquê responde metade da pergunta.
 */
export async function gravarBlocoAcao(
  _anterior: EstadoGravacao,
  dados: FormData,
): Promise<EstadoGravacao> {
  const slug = String(dados.get("slug") ?? "");
  const corpo = String(dados.get("corpo") ?? "").trim();
  const motivo = String(dados.get("motivo") ?? "").trim();

  if (!slug) return { erro: "bloco não identificado" };
  if (!corpo) return { erro: "o bloco não pode ficar vazio" };
  if (!motivo)
    return { erro: "diga por que mudou — é o que o histórico guarda" };

  try {
    const store = await radarStore();
    await store.gravarBloco(slug, corpo, motivo);
  } catch (erro) {
    return { erro: (erro as Error).message };
  }

  // O progresso e o portão de pipeline dependem disto, e vivem no layout.
  revalidatePath("/", "layout");
  return { gravadoEm: new Date().toISOString() };
}
