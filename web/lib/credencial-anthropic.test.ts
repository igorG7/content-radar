import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { credencialAnthropic } from "./credencial-anthropic";

/** Nenhuma das formas de autenticação presente. */
function semNada(dir: string) {
  for (const v of [
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_AUTH_TOKEN",
    "CLAUDE_CODE_OAUTH_TOKEN",
    "CLAUDE_CODE_USE_BEDROCK",
    "CLAUDE_CODE_USE_VERTEX",
  ]) {
    vi.stubEnv(v, undefined);
  }
  // Aponta a busca da sessão para um diretório vazio: sem isto o teste passaria
  // ou falharia conforme a máquina que o roda tenha Claude Code logado.
  vi.stubEnv("CLAUDE_CONFIG_DIR", dir);
}

const vazio = () => mkdtemp(path.join(tmpdir(), "cred-"));

afterEach(() => vi.unstubAllEnvs());

describe("credencial da Anthropic", () => {
  it("reconhece a chave de API", async () => {
    semNada(await vazio());
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-qualquer");
    const r = credencialAnthropic();
    expect(r.ok).toBe(true);
    expect(r.ok && r.origem).toBe("chave de API");
  });

  it("reconhece a sessão do Claude Code", async () => {
    const dir = await vazio();
    semNada(dir);
    await writeFile(path.join(dir, ".credentials.json"), "{}");
    expect(credencialAnthropic().ok).toBe(true);
  });

  it("recusa quando não há nenhuma", async () => {
    semNada(await vazio());
    const r = credencialAnthropic();
    expect(r.ok).toBe(false);
    // A mensagem é o produto: ela vai parar no evento `scan-aborted`, que é
    // onde alguém vai olhar depois de esperar por nada.
    expect(!r.ok && r.motivo).toMatch(/ANTHROPIC_API_KEY/);
    expect(!r.ok && r.motivo).toMatch(/sem login interativo/);
  });

  it("uma chave em branco não conta", async () => {
    // `ANTHROPIC_API_KEY=` num .env é o jeito mais fácil de achar que
    // configurou. Aceitar isso adiaria a descoberta para o fim do scan.
    semNada(await vazio());
    vi.stubEnv("ANTHROPIC_API_KEY", "   ");
    expect(credencialAnthropic().ok).toBe(false);
  });

  it("Bedrock e Vertex delegam ao provedor", async () => {
    semNada(await vazio());
    vi.stubEnv("CLAUDE_CODE_USE_BEDROCK", "1");
    expect(credencialAnthropic().ok).toBe(true);
  });
});
