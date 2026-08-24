"use server";

import { revalidatePath } from "next/cache";
import { gravarNomeDeExibicao, sessaoAtual } from "@/lib/sessao";

export interface EstadoNome {
  erro?: string;
}

/**
 * Grava o nome de exibição da pessoa que está logada.
 *
 * O id do usuário vem da sessão, nunca do formulário: aceitar um id enviado
 * pelo cliente deixaria qualquer um renomear outra conta.
 */
export async function gravarNomeAcao(
  _anterior: EstadoNome,
  dados: FormData,
): Promise<EstadoNome> {
  const sessao = await sessaoAtual();
  if (!sessao) return { erro: "sessão expirada — entre de novo" };

  const nome = String(dados.get("nome") ?? "").trim();
  if (nome.length > 60) return { erro: "no máximo 60 caracteres" };

  await gravarNomeDeExibicao(sessao.usuarioId, nome || null);
  // A barra de navegação mostra o nome, e ela vive no layout do shell.
  revalidatePath("/", "layout");
  return {};
}
