import "server-only";

import { Pool } from "pg";
import { provisionar } from "@/db/provisionar";
import { slugDoNome } from "@/lib/slug";

/**
 * Cadastro de cliente novo — o caminho pelo qual alguém que não é o dono do
 * servidor passa a ter um ambiente.
 *
 * Até aqui só existia `scripts/provisionar.mts`, linha de comando. Isso fazia do
 * produto uma ferramenta de um usuário só: cadastrar exigia acesso ao servidor.
 */

/** Menor senha aceita. Igual à do `provisionar`, que recusa abaixo disso. */
export const SENHA_MINIMA = 12;

export type ResultadoCadastro =
  { ok: true; slug: string; email: string } | { ok: false; erro: string };

/**
 * Procura um slug livre a partir do nome.
 *
 * Duas empresas podem se chamar igual, e a segunda não pode receber um erro
 * críptico de chave duplicada — recebe `nome-2`. A consulta e o insert não são
 * atômicos entre si, então o insert ainda pode colidir; quem chama trata isso
 * como colisão e tenta de novo, em vez de confiar na checagem prévia.
 */
async function slugLivre(pool: Pool, base: string): Promise<string> {
  const { rows } = await pool.query<{ slug: string }>(
    "select slug from ambiente where slug = $1 or slug like $2",
    [base, `${base}-%`],
  );
  const tomados = new Set(rows.map((r) => r.slug));
  if (!tomados.has(base)) return base;

  for (let n = 2; n < 1000; n++) {
    const tentativa = `${base}-${n}`;
    if (!tomados.has(tentativa)) return tentativa;
  }
  throw new Error(`sem slug livre para "${base}"`);
}

/**
 * Cria o ambiente e o usuário. **Não** abre sessão.
 *
 * Emitir o cookie aqui exigiria escopo de requisição, o que tornaria esta
 * função intestável fora de uma — e o teste que importa é justamente o de que
 * um cadastro recusado não deixa meio ambiente para trás. Quem chama entra pelo
 * `autenticar`, o mesmo caminho de quem já tinha conta: um lugar só decidindo o
 * que é sessão válida, porque o que diverge em autenticação vira brecha.
 *
 * Roda com a credencial da **aplicação**, não a do dono. Tudo que o cadastro
 * escreve — ambiente, usuário, config e os blocos vazios do vault — está dentro
 * das permissões de `radar_app`, então dar credencial de dono a um endpoint
 * público seria conceder direito de DDL para nada.
 */
export async function cadastrar(entrada: {
  nome: string;
  email: string;
  senha: string;
}): Promise<ResultadoCadastro> {
  const nome = entrada.nome.trim();
  const email = entrada.email.trim().toLowerCase();

  if (!nome) return { ok: false, erro: "informe o nome da empresa" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, erro: "e-mail inválido" };
  }
  if (entrada.senha.length < SENHA_MINIMA) {
    return {
      ok: false,
      erro: `a senha precisa de pelo menos ${SENHA_MINIMA} caracteres`,
    };
  }

  const base = slugDoNome(nome);
  if (!base) {
    return {
      ok: false,
      erro: "o nome precisa ter ao menos uma letra ou número",
    };
  }

  const urlApp = process.env.DATABASE_URL;
  if (!urlApp) throw new Error("DATABASE_URL ausente");

  const pool = new Pool({ connectionString: urlApp });
  let slug: string;
  try {
    const { rows } = await pool.query(
      "select 1 from usuario where email = $1",
      [email],
    );
    if (rows.length > 0) {
      return { ok: false, erro: "este e-mail já tem conta" };
    }
    slug = await slugLivre(pool, base);
  } finally {
    await pool.end();
  }

  try {
    await provisionar({ slug, nome, email, senha: entrada.senha }, urlApp);
  } catch (erro) {
    const texto = (erro as Error).message;
    // A checagem de e-mail acima é conveniência, não garantia: entre ela e o
    // insert cabe outro cadastro. A restrição do banco é quem decide, e o
    // usuário precisa da mesma frase nos dois caminhos.
    if (texto.includes("usuario_email_unique") || texto.includes("email")) {
      return { ok: false, erro: "este e-mail já tem conta" };
    }
    if (texto.includes("ambiente_slug_unique")) {
      return { ok: false, erro: "tente de novo — o nome acabou de ser usado" };
    }
    throw erro;
  }

  return { ok: true, slug, email };
}
