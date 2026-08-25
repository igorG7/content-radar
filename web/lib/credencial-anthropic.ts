import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

/**
 * Descobre por onde o Claude Agent SDK vai se autenticar — antes de a varredura
 * começar.
 *
 * ## Por que isto existe
 *
 * Hoje as varreduras autenticam pela sessão do Claude Code do usuário que roda
 * o processo (`~/.claude/.credentials.json`). Isso funciona nesta máquina, onde
 * alguém fez login, e **não existe** num servidor sem sessão interativa.
 *
 * O modo de falha é o pior possível: sem credencial a varredura não estoura, ela
 * termina. Já vimos exatamente isso hoje — uma execução que reportou sucesso
 * tendo abortado. Custa 25 minutos de espera para descobrir que nada foi feito,
 * e o registro fica dizendo que deu certo.
 *
 * Conferir antes é barato e transforma silêncio em mensagem.
 *
 * ## O que conta como credencial
 *
 * As formas que o pacote instalado reconhece (verificadas em
 * `node_modules/@anthropic-ai/claude-agent-sdk`, v0.3.236). A ordem aqui é de
 * diagnóstico, não de precedência — quem resolve a precedência é o SDK.
 */
export type Credencial =
  | { ok: true; origem: string }
  | { ok: false; motivo: string };

/**
 * O diretório de configuração do Claude Code, que `CLAUDE_CONFIG_DIR`
 * sobrescreve — o SDK respeita essa variável, e um servidor que rode o
 * trabalhador sob outro usuário costuma usá-la.
 */
function arquivoDeSessao(): string {
  const base = process.env.CLAUDE_CONFIG_DIR ?? path.join(homedir(), ".claude");
  return path.join(base, ".credentials.json");
}

export function credencialAnthropic(): Credencial {
  const cheia = (v: string | undefined) => !!v && v.trim().length > 0;

  // Bedrock e Vertex delegam a autenticação ao provedor de nuvem: as
  // credenciais são da AWS ou do Google, e não há o que conferir aqui.
  if (process.env.CLAUDE_CODE_USE_BEDROCK === "1")
    return { ok: true, origem: "Bedrock" };
  if (process.env.CLAUDE_CODE_USE_VERTEX === "1")
    return { ok: true, origem: "Vertex" };

  if (cheia(process.env.ANTHROPIC_API_KEY))
    return { ok: true, origem: "chave de API" };
  if (cheia(process.env.ANTHROPIC_AUTH_TOKEN))
    return { ok: true, origem: "ANTHROPIC_AUTH_TOKEN" };
  if (cheia(process.env.CLAUDE_CODE_OAUTH_TOKEN))
    return { ok: true, origem: "CLAUDE_CODE_OAUTH_TOKEN" };

  const sessao = arquivoDeSessao();
  if (existsSync(sessao))
    return { ok: true, origem: `sessão do Claude Code em ${sessao}` };

  return {
    ok: false,
    motivo:
      `sem credencial da Anthropic: ANTHROPIC_API_KEY não está definida e não há ` +
      `sessão do Claude Code em ${sessao}. ` +
      `Num servidor sem login interativo, defina ANTHROPIC_API_KEY no .env da instalação.`,
  };
}
