import { describe, expect, it } from "vitest";
import { rota } from "./rota";
import { SemSessao, StoreError } from "./store";

/**
 * O tradutor de recusas. O caso que motivou o arquivo é o primeiro: sem sessão,
 * toda rota devolvia 500 — "o servidor quebrou" no lugar de "faça login".
 */

const contexto = {} as never;

describe("rota", () => {
  it("devolve 401 quando não há sessão, não 500", async () => {
    const handler = rota(async () => {
      throw new SemSessao();
    });

    const r = await handler(new Request("http://x/api/qualquer"), contexto);
    expect(r.status).toBe(401);
    expect(await r.json()).toMatchObject({ code: "sem_sessao" });
  });

  it("traduz o código da camada em status", async () => {
    for (const [code, status] of [
      ["nao_encontrado", 404],
      ["candidata_invalida", 422],
    ] as const) {
      const handler = rota(async () => {
        throw new StoreError(code, "recusado");
      });
      const r = await handler(new Request("http://x/api/qualquer"), contexto);
      expect(r.status).toBe(status);
      expect(await r.json()).toMatchObject({ code, error: "recusado" });
    }
  });

  it("deixa passar o que não é recusa prevista", async () => {
    // Defeito engolido aqui viraria 500 mudo, sem stack em lugar nenhum — o
    // oposto do que este arquivo existe para resolver.
    const handler = rota(async () => {
      throw new TypeError("undefined não é função");
    });

    await expect(
      handler(new Request("http://x/api/qualquer"), contexto),
    ).rejects.toBeInstanceOf(TypeError);
  });

  it("não toca na resposta quando o handler responde", async () => {
    const handler = rota(async () => Response.json({ ok: true }));
    const r = await handler(new Request("http://x/api/qualquer"), contexto);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
  });
});
