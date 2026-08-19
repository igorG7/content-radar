import "server-only";

/**
 * Sessão de verdade: autentica contra a tabela `usuario` e guarda o resultado
 * num cookie assinado.
 *
 * Cookie e não `localStorage`, por duas razões que não são de conforto: o
 * `localStorage` é legível por qualquer script da página, e o servidor não o
 * enxerga — e é o servidor que precisa saber o ambiente, porque é ele que
 * declara `app.ambiente` na transação. Sessão em cliente não sustenta
 * row-level security.
 *
 * Assinado à mão em vez de biblioteca: com cadastro fechado, um papel só e
 * sessão sem estado, é HMAC sobre um payload pequeno. Menos superfície que
 * mais uma dependência.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { db } from "@/db/cliente";
import { ambiente as tAmbiente, usuario as tUsuario } from "@/db/schema";

const COOKIE = "radar-sessao";
const DURACAO_DIAS = 30;

export interface Sessao {
  usuarioId: string;
  email: string;
  ambienteId: string;
  ambienteSlug: string;
  ambienteNome: string;
  expiraEm: number;
}

function segredo(): string {
  const valor = process.env.SESSION_SECRET;
  if (!valor || valor.length < 32) {
    throw new Error(
      "SESSION_SECRET ausente ou curto demais — mínimo 32 caracteres",
    );
  }
  return valor;
}

function assinar(payload: string): string {
  return createHmac("sha256", segredo()).update(payload).digest("base64url");
}

function selar(sessao: Sessao): string {
  const payload = Buffer.from(JSON.stringify(sessao)).toString("base64url");
  return `${payload}.${assinar(payload)}`;
}

function abrir(cookie: string): Sessao | null {
  const [payload, assinatura] = cookie.split(".");
  if (!payload || !assinatura) return null;

  // Comparação em tempo constante: comparar strings com === vaza o tamanho do
  // prefixo correto por tempo de resposta.
  const esperada = Buffer.from(assinar(payload));
  const recebida = Buffer.from(assinatura);
  if (
    esperada.length !== recebida.length ||
    !timingSafeEqual(esperada, recebida)
  )
    return null;

  try {
    const sessao = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    ) as Sessao;
    return sessao.expiraEm > Date.now() ? sessao : null;
  } catch {
    return null;
  }
}

export async function sessaoAtual(): Promise<Sessao | null> {
  const cookie = (await cookies()).get(COOKIE)?.value;
  return cookie ? abrir(cookie) : null;
}

export type ResultadoLogin =
  { ok: true; sessao: Sessao } | { ok: false; erro: string };

export async function autenticar(
  email: string,
  senha: string,
): Promise<ResultadoLogin> {
  const [linha] = await db()
    .select({
      usuarioId: tUsuario.id,
      email: tUsuario.email,
      senhaHash: tUsuario.senhaHash,
      ambienteId: tAmbiente.id,
      ambienteSlug: tAmbiente.slug,
      ambienteNome: tAmbiente.nome,
    })
    .from(tUsuario)
    .innerJoin(tAmbiente, eq(tAmbiente.id, tUsuario.ambienteId))
    .where(eq(tUsuario.email, email.trim().toLowerCase()));

  // Mesma mensagem para e-mail inexistente e senha errada: distinguir os dois
  // entrega uma lista de contas válidas a quem estiver tentando.
  const generico = { ok: false as const, erro: "e-mail ou senha incorretos" };

  if (!linha) {
    // Verifica contra um hash descartável mesmo sem usuário, para o tempo de
    // resposta não denunciar quais e-mails existem.
    await argon2.hash(senha).catch(() => undefined);
    return generico;
  }
  if (!(await argon2.verify(linha.senhaHash, senha).catch(() => false)))
    return generico;

  const sessao: Sessao = {
    usuarioId: linha.usuarioId,
    email: linha.email,
    ambienteId: linha.ambienteId,
    ambienteSlug: linha.ambienteSlug,
    ambienteNome: linha.ambienteNome,
    expiraEm: Date.now() + DURACAO_DIAS * 24 * 60 * 60 * 1000,
  };

  (await cookies()).set(COOKIE, selar(sessao), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACAO_DIAS * 24 * 60 * 60,
  });

  return { ok: true, sessao };
}

export async function encerrarSessao(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
