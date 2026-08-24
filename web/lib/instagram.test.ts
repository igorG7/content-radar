import { describe, expect, it } from "vitest";
import { ehUrlDePost } from "./instagram";

/**
 * A regra vale nos dois lados. Antes valia só no formulário: a rota aceitava
 * `z.string().url()`, então qualquer URL entrava por fora da tela e o brief
 * ficava publicado apontando para nada.
 */
describe("URL de post do Instagram", () => {
  it("aceita post e reel, com ou sem www e barra final", () => {
    expect(ehUrlDePost("https://www.instagram.com/p/DXk2f9mAvz1/")).toBe(true);
    expect(ehUrlDePost("https://instagram.com/p/DXk2f9mAvz1")).toBe(true);
    expect(ehUrlDePost("https://www.instagram.com/reel/C8xTESTE001/")).toBe(
      true,
    );
  });

  it("aceita rastreador na query, que é como o link chega quando copiado", () => {
    expect(
      ehUrlDePost("https://www.instagram.com/p/DXk2f9mAvz1/?igsh=abc123"),
    ).toBe(true);
  });

  it("recusa URL válida que não é do Instagram", () => {
    // O caso que passava pela API: bem formada, e sem relação nenhuma com o post.
    expect(ehUrlDePost("https://exemplo.com")).toBe(false);
    expect(ehUrlDePost("https://instagram.com.br/p/DXk2f9mAvz1/")).toBe(false);
  });

  it("recusa perfil e story, que não são o post publicado", () => {
    expect(ehUrlDePost("https://www.instagram.com/avanzimoveis/")).toBe(false);
    expect(ehUrlDePost("https://www.instagram.com/stories/avanz/123/")).toBe(
      false,
    );
  });

  it("ignora espaço em volta, que sobra de copiar e colar", () => {
    expect(ehUrlDePost("  https://www.instagram.com/p/DXk2f9mAvz1/  ")).toBe(
      true,
    );
  });
});
