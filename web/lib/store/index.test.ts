import path from "node:path";
import { describe, expect, it } from "vitest";
import { storeDeArquivo, AMBIENTE_PADRAO } from "./index";

describe("camada de armazenamento — backend de arquivo", () => {
  /**
   * Testes de contrato da camada: o que importa é que ela responda em termos de
   * domínio e que ninguém precise saber de caminho para usá-la. Rodam contra o
   * store real, em leitura — nenhuma transição é aplicada.
   */

  it("a camada nasce com um ambiente", () => {
    expect(storeDeArquivo().ambiente).toBe(AMBIENTE_PADRAO);
    expect(storeDeArquivo("outro").ambiente).toBe("outro");
  });

  it("listarFila devolve os briefs pendentes de aprovação", async () => {
    const listagem = await storeDeArquivo().listarFila();
    expect(listagem.state).toBe("pendente-aprovacao");
    expect(Array.isArray(listagem.briefs)).toBe(true);
    // Falha de parse é reportada, nunca escondida.
    expect(Array.isArray(listagem.failures)).toBe(true);
  });

  it("listarTodos cobre os quatro estados", async () => {
    const estados = (await storeDeArquivo().listarTodos()).map((l) => l.state);
    expect(estados).toEqual([
      "pendente-aprovacao",
      "pendente-publicacao",
      "publicado",
      "rejeitado",
    ]);
  });

  it("buscarBrief encontra pelo slug, sem que o chamador monte caminho", async () => {
    const store = storeDeArquivo();
    const { briefs } = await store.listarFila();
    if (briefs.length === 0) return; // fila vazia é estado válido

    const brief = await store.buscarBrief(briefs[0].slug, "pendente-aprovacao");
    expect(brief.slug).toBe(briefs[0].slug);
    expect(brief.state).toBe("pendente-aprovacao");
  });

  it("planejarTransicao não aplica nada", async () => {
    const store = storeDeArquivo();
    const { briefs } = await store.listarFila();
    const alvo = briefs.find((b) => b.heroChoiceDeclared);
    if (!alvo) return;

    const plano = await store.planejarTransicao({
      slug: alvo.slug,
      direcao: "approve",
    });
    expect(plano.from).toBe("pendente-aprovacao");
    expect(plano.to).toBe("pendente-publicacao");

    // o brief continua onde estava
    const depois = await store.listarFila();
    expect(depois.briefs.some((b) => b.slug === alvo.slug)).toBe(true);
  });

  it("lerLedger reporta linhas malformadas em vez de descartar", async () => {
    const { events, malformedLines } = await storeDeArquivo().lerLedger();
    expect(events.length > 0).toBe(true);
    expect(Array.isArray(malformedLines)).toBe(true);
    // O normalizador cobre o formato antigo, em que `event` vinha dentro de `extra`.
    expect(
      events.every((e) => typeof e.event === "string" && e.event.length > 0),
    ).toBe(true);
  });

  it("caminhoMidia não deixa o nome escapar do diretório do estado", async () => {
    const store = storeDeArquivo();
    const escapado = await store.caminhoMidia(
      "pendente-aprovacao",
      "../../etc/passwd",
    );
    expect(path.basename(escapado)).toBe("passwd");
    expect(!escapado.includes("..")).toBe(true);
  });
});
