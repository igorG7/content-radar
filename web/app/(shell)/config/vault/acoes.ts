"use server";

import { revalidatePath } from "next/cache";
import { radarStore } from "@/lib/store";
import { HANDLE_OK } from "@/lib/instagram";

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

export interface EstadoContato {
  erro?: string;
  gravadoEm?: string;
}

const E164 = /^\+\d{11,15}$/;

/** `(31) 9 9077-4580` a partir de `+5531990774580`. */
function exibicaoDe(e164: string): string {
  const d = e164.replace(/\D/g, "");
  if (d.length < 12) return e164;
  const ddd = d.slice(2, 4);
  const resto = d.slice(4);
  return resto.length === 9
    ? `(${ddd}) ${resto[0]} ${resto.slice(1, 5)}-${resto.slice(5)}`
    : `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
}

/**
 * Grava os fatos da marca. A forma de exibição é derivada da canônica em vez de
 * pedida à parte: dois campos para o mesmo número divergem, e é o de exibição
 * que vai para a arte.
 */
export async function gravarContatoAcao(
  _anterior: EstadoContato,
  dados: FormData,
): Promise<EstadoContato> {
  const canal = String(dados.get("canalPrincipal") ?? "").trim();
  const principal = String(dados.get("telefoneE164") ?? "").trim();
  const secundario = String(dados.get("telefoneSecundarioE164") ?? "").trim();
  // Sem arroba e em minúsculas, como o Instagram guarda. Quem digita costuma
  // colar o @ junto, e guardá-lo faria a prévia mostrar "@@marca".
  const instagram = String(dados.get("instagram") ?? "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();

  if (!canal) return { erro: "escolha o canal principal" };
  if (instagram && !HANDLE_OK.test(instagram)) {
    return {
      erro: "o @ do Instagram aceita letras, números, ponto e sublinhado",
    };
  }
  if (!E164.test(principal)) {
    return {
      erro: "o número principal precisa estar em formato internacional",
    };
  }
  if (secundario && !E164.test(secundario)) {
    return { erro: "o número secundário está em formato inválido" };
  }

  try {
    const store = await radarStore();
    await store.gravarContato({
      canalPrincipal: canal,
      instagram: instagram || null,
      telefoneE164: principal,
      telefoneExibicao: exibicaoDe(principal),
      telefoneSecundarioE164: secundario || null,
    });
  } catch (erro) {
    return { erro: (erro as Error).message };
  }

  revalidatePath("/", "layout");
  return { gravadoEm: new Date().toISOString() };
}
