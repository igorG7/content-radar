import { describe, expect, it } from "vitest";
import { podeExportar } from "./acoes";
import { BRIEF_STATES } from "@/lib/manifest";

describe("quem pode baixar o pacote", () => {
  it("publicado continua exportável", () => {
    // O caso que quebrou: aprovar sem ter exportado antes deixava a pauta
    // publicada e sem nenhum caminho para obter o pacote. O botão só aparecia
    // para quem já tinha exportado — quem mais precisava era quem não via.
    expect(podeExportar("publicado")).toBe(true);
  });

  it("na fila e aguardando publicação também", () => {
    expect(podeExportar("pendente-aprovacao")).toBe(true);
    expect(podeExportar("pendente-publicacao")).toBe(true);
  });

  it("rejeitado não", () => {
    // Rejeitar apaga a mídia, local e remota. O pacote apontaria para foto
    // inexistente — entregar isso é pior que não entregar.
    expect(podeExportar("rejeitado")).toBe(false);
  });

  it("cobre todos os estados que existem", () => {
    // Se um estado novo aparecer, este teste obriga a decidir sobre ele em vez
    // de herdar um default silencioso.
    expect(BRIEF_STATES.length).toBe(4);
    for (const estado of BRIEF_STATES) {
      expect(typeof podeExportar(estado)).toBe("boolean");
    }
  });
});
