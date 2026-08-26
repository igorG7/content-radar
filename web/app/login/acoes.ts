"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { autenticar, encerrarSessao } from "@/lib/sessao";
import { perdoar, tentar } from "@/lib/limite";

/**
 * De onde vem a tentativa.
 *
 * Atrás de proxy, `x-forwarded-for` é o único sinal — e é falsificável, então
 * isto não identifica ninguém: serve para separar tentativas em baldes. Quem
 * variar o cabeçalho escapa do balde e cai no limite global.
 */
async function origem(): Promise<string> {
  const h = await headers();
  const encaminhado = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return encaminhado || h.get("x-real-ip") || "desconhecida";
}

/**
 * Dez por minuto por origem — folgado para quem erra a senha, apertado para um
 * laço. E um teto global, porque o cabeçalho de origem é escolhido por quem
 * chama: sem ele, variar o `x-forwarded-for` desfaz o limite inteiro.
 */
const POR_ORIGEM = { max: 10, janelaMs: 60_000 };
const GLOBAL = { max: 60, janelaMs: 60_000 };

export interface EstadoLogin {
  erro?: string;
}

export async function entrarAcao(
  _anterior: EstadoLogin,
  dados: FormData,
): Promise<EstadoLogin> {
  const email = String(dados.get("email") ?? "");
  const senha = String(dados.get("senha") ?? "");
  const destino = String(dados.get("destino") ?? "/");

  if (!email || !senha) return { erro: "preencha e-mail e senha" };

  /**
   * O limite vem antes do `autenticar`, e é esse o ponto: cada verificação
   * custa um argon2, que é caro de propósito. Conferir depois deixaria o custo
   * acontecer — o ataque seria contra a CPU do servidor, não contra a senha.
   */
  const chave = await origem();
  const daOrigem = tentar(`login:${chave}`, POR_ORIGEM);
  const doTodo = tentar("login:global", GLOBAL);
  if (!daOrigem.ok || !doTodo.ok) {
    const espera = Math.max(daOrigem.esperarSegundos, doTodo.esperarSegundos);
    return { erro: `muitas tentativas — espere ${espera}s e tente de novo` };
  }

  const r = await autenticar(email, senha);
  if (!r.ok) return { erro: r.erro };

  // Acertou: a origem não carrega os erros anteriores.
  perdoar(`login:${chave}`);

  // Só caminhos internos: `next=https://…` viraria redirecionamento aberto.
  redirect(
    destino.startsWith("/") && !destino.startsWith("//") ? destino : "/",
  );
}

export async function sairAcao(): Promise<void> {
  await encerrarSessao();
  redirect("/login");
}
