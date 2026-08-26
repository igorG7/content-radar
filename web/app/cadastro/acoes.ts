"use server";

import { redirect } from "next/navigation";
import { cadastrar } from "@/lib/cadastro";
import { autenticar } from "@/lib/sessao";
import { cadastroAberto } from "@/lib/cadastro-aberto";
import { headers } from "next/headers";
import { tentar } from "@/lib/limite";

/**
 * Bem mais apertado que o login: criar conta é operação rara, e cada uma custa
 * um argon2 mais um ambiente inteiro no banco — vault, config, o conjunto todo.
 * Três por hora por origem é generoso para quem erra o formulário.
 */
const POR_ORIGEM = { max: 3, janelaMs: 3_600_000 };

export interface EstadoCadastro {
  erro?: string;
}

export async function cadastrarAcao(
  _anterior: EstadoCadastro,
  dados: FormData,
): Promise<EstadoCadastro> {
  /**
   * Conferido aqui também. Esconder a página não fecha o cadastro: ação de
   * servidor é endereçável por conta própria, e proteger só a tela protege
   * apenas quem passa por ela.
   */
  if (!cadastroAberto()) return { erro: "o cadastro está fechado" };

  const h = await headers();
  const origem =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "desconhecida";
  const permitido = tentar(`cadastro:${origem}`, POR_ORIGEM);
  if (!permitido.ok) {
    return { erro: "muitas contas criadas daqui — tente mais tarde" };
  }

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
