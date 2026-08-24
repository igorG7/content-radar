import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { bancoDisponivel } from "./teste-banco";
import { backendPostgres } from "./backend";
import { encerrarPool } from "./cliente";
import { StoreError } from "../lib/store";
import { porNome } from "../lib/chat/ferramentas";

/**
 * Anexos do chat. O que se exige: que o arquivo chegue ao agente, que não
 * atravesse para outro cliente, e que caia junto com a conversa — porque não
 * existe purga própria e não deve existir referência pendurada.
 */

const disponivel = await bancoDisponivel();
const SLUG = `teste-anexo-${process.pid}`;
let ambienteId = "";
let outroId = "";

async function dono(q: string, p: unknown[] = []) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_MIGRATIONS,
  });
  const { rows } = await pool.query(q, p);
  await pool.end();
  return rows;
}

beforeAll(async () => {
  if (!disponivel) return;
  for (const s of [SLUG, `${SLUG}-outro`]) {
    await dono("delete from ambiente where slug = $1", [s]);
  }
  [{ id: ambienteId }] = await dono(
    "insert into ambiente (slug, nome, prefixo_midia) values ($1,$1,$1) returning id",
    [SLUG],
  );
  [{ id: outroId }] = await dono(
    "insert into ambiente (slug, nome, prefixo_midia) values ($1,$1,$1) returning id",
    [`${SLUG}-outro`],
  );
});

afterAll(async () => {
  if (disponivel) {
    for (const s of [SLUG, `${SLUG}-outro`]) {
      await dono("delete from ambiente where slug = $1", [s]);
    }
  }
  await encerrarPool();
});

const conteudo = "linha um\nlinha dois";

async function comAnexo(ambiente: string, nome = "notas.txt") {
  const store = backendPostgres(ambiente);
  const conversa = await store.criarConversa("Conversa com anexo");
  const anexo = await store.guardarAnexo({
    conversaId: conversa.id,
    nome,
    mime: "text/plain",
    bytes: Buffer.byteLength(conteudo),
    conteudo,
  });
  return { store, conversa, anexo };
}

describe.skipIf(!disponivel)("anexo do chat", () => {
  it("guarda e devolve o conteúdo", async () => {
    const { store, anexo } = await comAnexo(ambienteId);
    const lido = await store.lerAnexo(anexo.id);
    expect(lido.conteudo).toBe(conteudo);
    expect(lido.nome).toBe("notas.txt");
  });

  it("a lista não carrega o conteúdo", async () => {
    // A barra lateral abre a conversa; trazer o texto de todo anexo junto
    // carregaria o que ninguém pediu.
    const { store, conversa } = await comAnexo(ambienteId);
    const [primeiro] = await store.listarAnexos(conversa.id);
    expect(primeiro.nome).toBe("notas.txt");
    expect(primeiro).not.toHaveProperty("conteudo");
  });

  it("um cliente não lê o anexo de outro", async () => {
    // O que a pessoa anexa é dela. Vazar aqui é pior que vazar pauta: pode ser
    // qualquer arquivo que ela tenha decidido mostrar ao agente.
    const { anexo } = await comAnexo(ambienteId);
    await expect(backendPostgres(outroId).lerAnexo(anexo.id)).rejects.toThrow(
      StoreError,
    );
  });

  it("recusa anexo apontando para conversa de outro cliente", async () => {
    const { conversa } = await comAnexo(ambienteId);
    await expect(
      backendPostgres(outroId).guardarAnexo({
        conversaId: conversa.id,
        nome: "invasor.txt",
        mime: "text/plain",
        bytes: 3,
        conteudo: "abc",
      }),
    ).rejects.toThrow();
  });

  it("cai junto com a conversa", async () => {
    // Sem purga própria de propósito: apagar o anexo antes deixaria a mensagem
    // "anexou notas.txt" sem nada atrás.
    const { store, conversa, anexo } = await comAnexo(ambienteId);
    await store.excluirConversa(conversa.id);
    await expect(store.lerAnexo(anexo.id)).rejects.toThrow(StoreError);
  });

  it("a ferramenta entrega o conteúdo ao agente", async () => {
    const { store, conversa } = await comAnexo(ambienteId);
    const ferramenta = porNome("ler_anexo");
    expect(ferramenta).toBeDefined();

    const r = await ferramenta!.executar(
      store,
      { nome: "notas.txt" },
      { conversaId: conversa.id },
    );
    expect(r.conteudo).toBe(conteudo);
  });

  it("a ferramenta diz o que existe quando o nome não bate", async () => {
    // Devolver a lista poupa um turno inteiro quando o modelo errou por pouco.
    const { store, conversa } = await comAnexo(ambienteId);
    const r = await porNome("ler_anexo")!.executar(
      store,
      { nome: "outro.txt" },
      { conversaId: conversa.id },
    );
    expect(r.erro).toBeTruthy();
    expect(r.disponiveis).toEqual(["notas.txt"]);
  });

  it("a ferramenta não vê anexo de outra conversa", async () => {
    // O contexto vem de quem chama, não do modelo: id que o modelo escolhe é
    // id que o modelo pode trocar.
    const { store } = await comAnexo(ambienteId);
    const vazia = await store.criarConversa("Sem anexo");
    const r = await porNome("anexos_da_conversa")!.executar(
      store,
      {},
      { conversaId: vazia.id },
    );
    expect(r.anexos).toEqual([]);
  });
});
