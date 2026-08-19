"use server";

import { redirect } from "next/navigation";
import { autenticar, encerrarSessao } from "@/lib/sessao";

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

  const r = await autenticar(email, senha);
  if (!r.ok) return { erro: r.erro };

  // Só caminhos internos: `next=https://…` viraria redirecionamento aberto.
  redirect(
    destino.startsWith("/") && !destino.startsWith("//") ? destino : "/",
  );
}

export async function sairAcao(): Promise<void> {
  await encerrarSessao();
  redirect("/login");
}
