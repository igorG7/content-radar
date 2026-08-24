import { describe, expect, it, afterEach } from "vitest";
import { cadastroAberto } from "./cadastro-aberto";

/**
 * Fechado por padrão. Um deploy que esqueça a variável nasce fechado — que é o
 * erro barato. O contrário faria de cada servidor novo uma torneira de
 * ambientes até alguém perceber.
 */
const original = process.env.CADASTRO_ABERTO;
afterEach(() => {
  if (original === undefined) delete process.env.CADASTRO_ABERTO;
  else process.env.CADASTRO_ABERTO = original;
});

describe("o cadastro público", () => {
  it("está fechado quando ninguém disse nada", () => {
    delete process.env.CADASTRO_ABERTO;
    expect(cadastroAberto()).toBe(false);
  });

  it("abre só com o valor exato", () => {
    process.env.CADASTRO_ABERTO = "1";
    expect(cadastroAberto()).toBe(true);
  });

  it("não abre por engano", () => {
    // `true`, `sim`, `yes` — tentativas plausíveis que devem falhar fechando,
    // porque quem digitou errado achou que tinha aberto.
    for (const valor of ["true", "sim", "yes", "0", "", "ok"]) {
      process.env.CADASTRO_ABERTO = valor;
      expect(cadastroAberto(), `valor "${valor}"`).toBe(false);
    }
  });
});
