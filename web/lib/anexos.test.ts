import { describe, expect, it } from "vitest";
import {
  ACCEPT,
  EXTENSOES,
  LIMITE_BYTES,
  MAX_ARQUIVOS,
  acrescentar,
  avaliar,
} from "./anexos";

/**
 * A mesma regra vale no seletor e na rota. Antes o seletor anunciava PNG, JPEG,
 * WebP e PDF — formatos que nada no caminho sabia ler —, e o resultado era
 * anexar um PDF e ouvir do agente que não tinha chegado nada.
 */
describe("o que o chat aceita como anexo", () => {
  it("aceita os formatos de texto", () => {
    for (const ext of EXTENSOES) {
      expect(avaliar({ name: `notas${ext}`, size: 100 })).toBeNull();
    }
  });

  it("recusa o que não sabe ler, dizendo o que aceita", () => {
    const r = avaliar({ name: "planta.pdf", size: 100 });
    expect(r).not.toBeNull();
    expect(r!.motivo).toContain(".txt");
  });

  it("recusa imagem — não é texto e não seria lida", () => {
    expect(avaliar({ name: "foto.png", size: 100 })).not.toBeNull();
  });

  it("recusa acima do limite", () => {
    // O limite é de contexto, não de banco: o conteúdo vai inteiro ao agente.
    expect(
      avaliar({ name: "grande.txt", size: LIMITE_BYTES + 1 }),
    ).not.toBeNull();
    expect(avaliar({ name: "no limite.txt", size: LIMITE_BYTES })).toBeNull();
  });

  it("recusa arquivo vazio", () => {
    // Subir zero byte gasta um turno do agente para dizer que não há nada.
    expect(avaliar({ name: "vazio.txt", size: 0 })).not.toBeNull();
  });

  it("não se importa com maiúscula na extensão", () => {
    expect(avaliar({ name: "NOTAS.TXT", size: 10 })).toBeNull();
  });

  it("o accept do seletor lista exatamente o que a regra aceita", () => {
    // Duas listas divergem, e a que diverge para mais é a que deixa passar.
    expect(ACCEPT.split(",").sort()).toEqual([...EXTENSOES].sort());
  });
});

/** Um File de mentira, o suficiente para a decisão — que só olha nome e tamanho. */
const arquivo = (nome: string, tamanho = 100) =>
  ({ name: nome, size: tamanho, type: "text/plain" }) as File;

describe("montar a lista de anexos", () => {
  it("o arquivo aceito entra na lista", () => {
    // O caso que falhava na tela: escolher um .txt e nada aparecer.
    const { anexos, recusados } = acrescentar([], [arquivo("nota.txt")]);
    expect(anexos).toHaveLength(1);
    expect(anexos[0].nome).toBe("nota.txt");
    expect(recusados).toEqual([]);
  });

  it("guarda o arquivo para poder subir depois", () => {
    // Sem isto o chip existia e o conteúdo ficava no navegador.
    const f = arquivo("nota.txt");
    expect(acrescentar([], [f]).anexos[0].arquivo).toBe(f);
  });

  it("a recusa sai junto, não depois", () => {
    /**
     * O defeito que deixava a tela muda: as recusas eram colhidas dentro do
     * updater do estado e lidas fora dele, então chegavam vazias — arquivo
     * rejeitado sumia sem chip e sem motivo.
     */
    const { anexos, recusados } = acrescentar([], [arquivo("planta.pdf")]);
    expect(anexos).toEqual([]);
    expect(recusados).toHaveLength(1);
    expect(recusados[0]).toContain("planta.pdf");
  });

  it("aceita uns e recusa outros na mesma escolha", () => {
    const r = acrescentar([], [arquivo("ok.txt"), arquivo("nao.pdf")]);
    expect(r.anexos.map((a) => a.nome)).toEqual(["ok.txt"]);
    expect(r.recusados).toHaveLength(1);
  });

  it("não duplica o mesmo arquivo", () => {
    const { anexos } = acrescentar([], [arquivo("nota.txt")]);
    const r = acrescentar(anexos, [arquivo("nota.txt")]);
    expect(r.anexos).toHaveLength(1);
    expect(r.recusados[0]).toContain("já anexado");
  });

  it("respeita o limite de arquivos", () => {
    const muitos = Array.from({ length: MAX_ARQUIVOS + 2 }, (_, i) =>
      arquivo(`n${i}.txt`),
    );
    const r = acrescentar([], muitos);
    expect(r.anexos).toHaveLength(MAX_ARQUIVOS);
    expect(r.recusados).toHaveLength(2);
  });

  it("preserva o que já estava na lista", () => {
    const { anexos } = acrescentar([], [arquivo("um.txt")]);
    expect(acrescentar(anexos, [arquivo("dois.txt")]).anexos).toHaveLength(2);
  });
});
