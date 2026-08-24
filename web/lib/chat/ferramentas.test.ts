import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { bancoDisponivel } from "../../db/teste-banco";
import { backendPostgres } from "../../db/backend";
import { encerrarPool } from "../../db/cliente";
import { FERRAMENTAS, porNome } from "./ferramentas";

/**
 * As ferramentas do chat. O que se exige delas: recusar antes de gastar, falar
 * o vocabulário do ambiente certo, e nunca aceitar ambiente como argumento.
 */

const disponivel = await bancoDisponivel();

const A = "teste-ferramentas-a";
const B = "teste-ferramentas-b";
const ids: Record<string, string> = {};

async function dono(q: string, p: unknown[] = []) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_MIGRATIONS,
  });
  const { rows } = await pool.query(q, p);
  await pool.end();
  return rows;
}

async function noAmbiente(slug: string, q: string, p: unknown[] = []) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_MIGRATIONS,
  });
  try {
    await pool.query("begin");
    await pool.query("select set_config('app.ambiente', $1, true)", [
      ids[slug],
    ]);
    const { rows } = await pool.query(q, p);
    await pool.query("commit");
    return rows;
  } finally {
    await pool.end();
  }
}

const chamar = (
  slug: string,
  nome: string,
  args: Record<string, unknown> = {},
) => porNome(nome)!.executar(backendPostgres(ids[slug]), args);

beforeAll(async () => {
  if (!disponivel) return;
  for (const [slug, pilar, escopo] of [
    [A, "decisao", "local"],
    [B, "bastidor", "trends"],
  ] as const) {
    await dono("delete from ambiente where slug = $1", [slug]);
    const rows = await dono(
      "insert into ambiente (slug, nome, prefixo_midia) values ($1,$1,$1) returning id",
      [slug],
    );
    ids[slug] = rows[0].id;

    await noAmbiente(
      slug,
      `insert into pilar (ambiente_id, slug, nome, corpo, ordem, no_radar)
       values ($1, $2, $2, 'descrição do pilar', 1, true)`,
      [ids[slug], pilar],
    );
    await noAmbiente(
      slug,
      `insert into escopo_busca (ambiente_id, slug, label, ativo)
       values ($1, $2, $2, true)`,
      [ids[slug], escopo],
    );
    await noAmbiente(
      slug,
      `insert into fonte (ambiente_id, escopo_slug, slug, url, ativo)
       values ($1, $2, 'fonte-um', 'https://exemplo.test', true)`,
      [ids[slug], escopo],
    );
  }

  // Um pilar que existe na estratégia mas está fora do radar.
  await noAmbiente(
    A,
    `insert into pilar (ambiente_id, slug, nome, corpo, ordem, no_radar)
     values ($1, 'bastidor', 'Bastidor', 'vive nos stories', 4, false)`,
    [ids[A]],
  );
});

afterAll(async () => {
  if (disponivel) {
    for (const slug of [A, B]) {
      await dono("delete from ambiente where slug = $1", [slug]);
    }
  }
  await encerrarPool();
});

describe("catálogo", () => {
  it("nenhuma ferramenta aceita ambiente como parâmetro", () => {
    // É o que impede a fronteira entre clientes de depender do modelo se
    // comportar: o ambiente vem do store da sessão, nunca do argumento.
    for (const f of FERRAMENTAS) {
      expect(Object.keys(f.parametros)).not.toContain("ambiente");
      expect(Object.keys(f.parametros)).not.toContain("ambiente_id");
    }
  });

  it("nenhuma ferramenta muda estado de brief", () => {
    // Aprovar e publicar são decisão humana com botão próprio.
    const suspeitas = FERRAMENTAS.filter((f) =>
      /aprovar|publicar|rejeitar|mover|transicao/i.test(f.nome),
    );
    expect(suspeitas).toEqual([]);
  });
});

describe.skipIf(!disponivel)("ferramentas contra o banco", () => {
  it("descreve os escopos com as fontes ativas", async () => {
    const r = (await chamar(A, "escopos_de_busca")) as {
      escopos: { slug: string; ativo: boolean; fontes: unknown[] }[];
    };
    expect(r.escopos.map((e) => e.slug)).toEqual(["local"]);
    expect(r.escopos[0].fontes).toHaveLength(1);
  });

  it("entrega o vocabulário e diz o que fica fora do radar", async () => {
    const r = (await chamar(A, "pilares_e_publicos")) as {
      pilares: { slug: string; entra_no_radar: boolean }[];
    };
    const bastidor = r.pilares.find((p) => p.slug === "bastidor");
    expect(bastidor?.entra_no_radar).toBe(false);
  });

  it("recusa escopo inventado antes de enfileirar nada", async () => {
    const r = await chamar(A, "pedir_varredura", { escopo: "inexistente" });
    expect(r.recusado).toBe(true);
    expect(r.escopos_ativos).toEqual(["local"]);

    // Recusar de verdade é não deixar rastro: se tivesse enfileirado, a
    // varredura existiria.
    expect(await chamar(A, "varredura_atual")).toEqual({ nenhuma: true });
  });

  it("recusa pilar que não entra no radar, explicando", async () => {
    const r = await chamar(A, "pedir_varredura", {
      escopo: "local",
      pilar: "bastidor",
    });
    expect(r.recusado).toBe(true);
    expect(String(r.motivo)).toContain("não entra no radar");
  });

  it("enfileira e passa a acompanhar", async () => {
    const r = await chamar(A, "pedir_varredura", {
      escopo: "local",
      pilar: "decisao",
      alvo: 3,
    });
    expect(r.enfileirada).toBe(true);
    expect(r.posicao_na_fila).toBeGreaterThanOrEqual(1);

    const atual = (await chamar(A, "varredura_atual")) as {
      em_andamento: boolean;
      pedido: unknown;
    };
    expect(atual.em_andamento).toBe(true);
    expect(atual.pedido).toEqual({
      escopo: "local",
      pilar: "decisao",
      alvo: 3,
    });
  });

  it("recusa a segunda varredura em vez de acumular", async () => {
    const r = await chamar(A, "pedir_varredura", { escopo: "local" });
    expect(r.recusado).toBe(true);
    expect(r.code).toBe("ja_rodando");
  });

  it("um ambiente não enxerga o vocabulário nem a varredura do outro", async () => {
    // A ferramenta é a mesma; o que muda é o store que ela recebe. Se o
    // isolamento dependesse do argumento, este teste passaria por acaso.
    const vB = (await chamar(B, "pilares_e_publicos")) as {
      pilares: { slug: string }[];
    };
    expect(vB.pilares.map((p) => p.slug)).toEqual(["bastidor"]);
    expect(await chamar(B, "varredura_atual")).toEqual({ nenhuma: true });
  });

  it("simular_varredura existe e não enfileira", async () => {
    /**
     * O agente respondia não conhecer dry-run porque nenhuma ferramenta o
     * expunha — a skill o suporta desde sempre (`--dry-run` é sagrado lá) e o
     * chat não sabia.
     */
    const f = porNome("simular_varredura");
    expect(f).toBeDefined();
    expect(f!.parametros.escopo.obrigatorio).toBe(true);
    // O pilar é opcional: simular "todos" é pergunta legítima.
    expect(f!.parametros.pilar.obrigatorio).toBeUndefined();
  });

  it("pedir e simular são ferramentas distintas", () => {
    // Fundir as duas num parâmetro faria o modelo enfileirar por engano ao
    // errar um booleano — e enfileirar é trabalho pago que não se cancela.
    expect(porNome("pedir_varredura")).toBeDefined();
    expect(porNome("simular_varredura")).toBeDefined();
    expect(porNome("pedir_varredura")).not.toBe(porNome("simular_varredura"));
  });
});
