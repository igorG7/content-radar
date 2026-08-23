"use server";

import { redirect } from "next/navigation";
import { cadastrar } from "@/lib/cadastro";
import { autenticar } from "@/lib/sessao";

export interface EstadoCadastro {
  erro?: string;
}

export async function cadastrarAcao(
  _anterior: EstadoCadastro,
  dados: FormData,
): Promise<EstadoCadastro> {
  const r = await cadastrar({
    nome: String(dados.get("nome") ?? ""),
    email: String(dados.get("email") ?? ""),
    senha: String(dados.get("senha") ?? ""),
  });

  if (!r.ok) return { erro: r.erro };

  // Entrar pelo mesmo caminho de quem já tinha conta.
  const login = await autenticar(r.email, String(dados.get("senha") ?? ""));
  if (!login.ok) return { erro: login.erro };

  /**
   * Direto para o vault, não para o painel.
   *
   * O painel de um ambiente recém-criado não tem o que mostrar, e o
   * `PipelineGate` já explica que falta vault — mas explicar o vazio é pior do
   * que não passar por ele. A primeira tela de quem acabou de se cadastrar é a
   * primeira pergunta da entrevista.
   */
  redirect("/config/vault");
}
