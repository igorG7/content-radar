import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { backendPostgres } from "./backend";
import { encerrarPool } from "./cliente";
import { StoreError } from "../lib/store";

/**
 * A conversa do chat passou a viver no banco.
 *
 * Antes ela existia na aba: recarregar perdia o histórico e o ponteiro para a
 * memória do agente, então nem retomar era possível. O que se exige aqui é que
 * sobreviva, que a memória venha junto, e que uma conversa não apareça para
 * outro cliente.
 */

const disponivel = await (async () => {
  if (!process.env.DATABASE_URL_MIGRATIONS) return false;
  const sonda = new Pool({
    connectionString: process.env.DATABASE_URL_MIGRATIONS,
  });
  try {
    await sonda.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    await sonda.end();
  }
})();

const A = "teste-conversa-a";
const B = "teste-conversa-b";
const ids: Record<string, string> = {};

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
  for (const slug of [A, B]) {
    await dono("delete from ambiente where slug = $1", [slug]);
    const rows = await dono(
      "insert into ambiente (slug, nome, prefixo_midia) values ($1,$1,$1) returning id",
      [slug],
    );
    ids[slug] = rows[0].id;
  }
});

afterAll(async () => {
  if (disponivel) {
    for (const slug of [A, B]) {
      await dono("delete from ambiente where slug = $1", [slug]);
    }
  }
  await encerrarPool();
});

describe.skipIf(!disponivel)("conversa do chat", () => {
  it("sobrevive: mensagens voltam na ordem em que foram ditas", async () => {
    const loja = backendPostgres(ids[A]);
    const c = await loja.criarConversa("Sobre a fila");

    await loja.gravarMensagem(c.id, { papel: "usuario", corpo: "quantos?" });
    await loja.gravarMensagem(c.id, {
      papel: "agente",
      corpo: "três",
      ferramentas: ["resumo_da_fila"],
      modelo: "padrao",
    });

    const lida = await loja.buscarConversa(c.id);
    expect(lida.mensagens.map((m) => m.corpo)).toEqual(["quantos?", "três"]);
    // O que o agente consultou vem junto: sem isso a resposta vira adivinhação.
    expect(lida.mensagens[1].ferramentas).toEqual(["resumo_da_fila"]);
  });

  it("guarda a sessão do agente com a mensagem que a produziu", async () => {
    // O ponteiro para a memória do SDK morava no navegador; um F5 apagava a
    // memória junto. Gravá-lo numa chamada à parte deixaria a janela em que a
    // conversa termina sem ele.
    const loja = backendPostgres(ids[A]);
    const c = await loja.criarConversa("Com memória");
    await loja.gravarMensagem(c.id, {
      papel: "agente",
      corpo: "ok",
      sessaoAgente: "sess-123",
    });

    expect((await loja.buscarConversa(c.id)).sessaoAgente).toBe("sess-123");
  });

  it("lista da mais recente para a mais antiga, sem carregar as mensagens", async () => {
    const loja = backendPostgres(ids[A]);
    const antiga = await loja.criarConversa("Antiga");
    const nova = await loja.criarConversa("Nova");
    await loja.gravarMensagem(nova.id, { papel: "usuario", corpo: "oi" });

    const lista = await loja.listarConversas();
    expect(lista[0].id).toBe(nova.id);
    expect(lista.map((c) => c.id)).toContain(antiga.id);
    // Carregar o histórico de todas para desenhar a barra lateral traria o
    // ambiente inteiro a cada abertura da tela.
    expect(lista[0]).not.toHaveProperty("mensagens");
  });

  it("excluir a conversa leva as mensagens junto", async () => {
    const loja = backendPostgres(ids[A]);
    const c = await loja.criarConversa("Descartável");
    await loja.gravarMensagem(c.id, { papel: "usuario", corpo: "some" });
    await loja.excluirConversa(c.id);

    await expect(loja.buscarConversa(c.id)).rejects.toBeInstanceOf(StoreError);
    const [{ n }] = await dono(
      "select count(*)::int as n from mensagem where conversa_id = $1",
      [c.id],
    );
    expect(n).toBe(0);
  });

  it("um ambiente não enxerga a conversa de outro", async () => {
    const doA = await backendPostgres(ids[A]).criarConversa("Privada de A");

    expect(
      (await backendPostgres(ids[B]).listarConversas()).map((c) => c.id),
    ).not.toContain(doA.id);
    await expect(
      backendPostgres(ids[B]).buscarConversa(doA.id),
    ).rejects.toBeInstanceOf(StoreError);
  });

  it("o dono do banco também não escapa da política", async () => {
    // FORCE ROW LEVEL SECURITY: sem ele o isolamento passaria a depender de com
    // qual papel a conexão foi aberta. O drizzle-kit só emite ENABLE.
    const [linha] = await dono(
      "select relforcerowsecurity from pg_class where relname = 'conversa'",
    );
    expect(linha.relforcerowsecurity).toBe(true);
  });
});
