import { describe, expect, it, beforeEach } from "vitest";
import { esquecerTudo, perdoar, tentar } from "./limite";

/**
 * O limite existe por dois motivos, e o segundo costuma ser esquecido: força
 * bruta contra a senha, e consumo de CPU. O argon2 é caro de propósito, então
 * tentativas ilimitadas derrubam a máquina antes de descobrirem qualquer senha.
 */
const OPCOES = { max: 3, janelaMs: 60_000 };

beforeEach(esquecerTudo);

describe("limite de tentativas", () => {
  it("deixa passar até o máximo", () => {
    for (let i = 0; i < 3; i++) {
      expect(tentar("ip", OPCOES).ok).toBe(true);
    }
  });

  it("barra a partir do máximo, dizendo quanto esperar", () => {
    // "Tente de novo" sem prazo faz a pessoa tentar de novo na hora — e cada
    // tentativa custa um argon2.
    for (let i = 0; i < 3; i++) tentar("ip", OPCOES);
    const v = tentar("ip", OPCOES);
    expect(v.ok).toBe(false);
    expect(v.esperarSegundos).toBeGreaterThan(0);
    expect(v.esperarSegundos).toBeLessThanOrEqual(60);
  });

  it("chaves diferentes não se afetam", () => {
    // Senão um atacante travaria o login de todo mundo esgotando uma chave só.
    for (let i = 0; i < 3; i++) tentar("ip-a", OPCOES);
    expect(tentar("ip-b", OPCOES).ok).toBe(true);
  });

  it("a janela desliza: quem esperou volta a passar", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) tentar("ip", OPCOES, t0);
    expect(tentar("ip", OPCOES, t0 + 59_000).ok).toBe(false);
    expect(tentar("ip", OPCOES, t0 + 61_000).ok).toBe(true);
  });

  it("quem parou de tentar libera antes de quem insistiu", () => {
    /**
     * A espera é até a tentativa mais antiga sair da janela, não um prazo fixo.
     * Com prazo fixo, insistir durante o bloqueio não custaria nada — e insistir
     * é exatamente o comportamento a desencorajar.
     */
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) tentar("insiste", OPCOES, t0);
    // Continua batendo durante o bloqueio.
    tentar("insiste", OPCOES, t0 + 30_000);
    const v = tentar("insiste", OPCOES, t0 + 59_000);
    expect(v.ok).toBe(false);
  });

  it("acertar perdoa a chave", () => {
    // Quem errou duas vezes e acertou não deve arrastar as duas falhas.
    tentar("ip", OPCOES);
    tentar("ip", OPCOES);
    perdoar("ip");
    for (let i = 0; i < 3; i++) expect(tentar("ip", OPCOES).ok).toBe(true);
  });
});
