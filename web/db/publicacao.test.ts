import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { backendPostgres } from "./backend";
import { encerrarPool } from "./cliente";
import { StoreError } from "../lib/store";

/**
 * As duas pontas que fecham o ciclo do brief, agora em código: registrar que o
 * post saiu, e gerar o pacote que a pessoa leva para o Smart Design.
 *
 * Eram skills que liam e escreviam arquivo. O que se exige delas aqui: mudar
 * estado só a partir do estado certo, deixar rastro auditável no ledger, e — no
 * caso do pacote — sair como texto, sem tocar em disco.
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

const SLUG = "teste-publicacao";
let ambienteId = "";

async function dono(q: string, p: unknown[] = []) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_MIGRATIONS,
  });
  const { rows } = await pool.query(q, p);
  await pool.end();
  return rows;
}

/**
 * Lê como dono **com o ambiente declarado**. Sob FORCE ROW LEVEL SECURITY o
 * dono também não enxerga linha nenhuma: sem isto o select volta vazio e a
 * asserção falha por invisibilidade, não por dado errado.
 */
async function noAmbiente(q: string, p: unknown[] = []) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_MIGRATIONS,
  });
  try {
    await pool.query("begin");
    await pool.query("select set_config('app.ambiente', $1, true)", [
      ambienteId,
    ]);
    const { rows } = await pool.query(q, p);
    await pool.query("commit");
    return rows;
  } finally {
    await pool.end();
  }
}

/** Um brief no estado pedido, com o mínimo para o pacote fazer sentido. */
let sequencia = 0;

async function semearBrief(slug: string, estado: string) {
  const ref = `W34-${String(++sequencia).padStart(3, "0")}`;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_MIGRATIONS,
  });
  try {
    await pool.query("begin");
    await pool.query("select set_config('app.ambiente', $1, true)", [
      ambienteId,
    ]);
    const { rows } = await pool.query(
      `insert into brief (
         ambiente_id, slug, brief_id, estado, pilar_slug, publico_slug,
         headline, hook, caption_draft, cta, hashtags, topic_hash,
         hero_indice, hero_decidido_em, visual_brief, destino_od, origem
       ) values (
         $1, $2, $5, $3, 'decisao', 'investidor',
         'Lote na RMBH com escritura', 'E se o barato saísse caro?',
         'Legenda de teste.', 'Chama no WhatsApp', '{rmbh,lote}', $4,
         0, now(),
         -- snake_case porque é o que o pipeline escreve de verdade; o fixture
         -- em camelCase escondia o descasamento que a tela sofria.
         '{"aspect_ratio":"4:5","must_have":["mapa"],"avoid_visual":["stock genérico"]}',
         '{"od_skill_ref":"carrossel-comparativo","alternativas":["card-dado"]}',
         '{"why_match":"escritura é o critério de decisão do ICP investidor"}'
       ) returning id`,
      [ambienteId, slug, estado, `hash-${slug}`, ref],
    );
    await pool.query(
      `insert into brief_candidata (ambiente_id, brief_id, indice, objeto_path, cloud_url)
       values ($1, $2, 0, 'midia/hero-0.jpg', 'https://res.cloudinary.com/x/hero-0.jpg')`,
      [ambienteId, rows[0].id],
    );
    await pool.query("commit");
    return rows[0].id as string;
  } finally {
    await pool.end();
  }
}

describe.skipIf(!disponivel)("publicar e exportar", () => {
  beforeAll(async () => {
    await dono("delete from ambiente where slug = $1", [SLUG]);
    const rows = await dono(
      "insert into ambiente (slug, nome, prefixo_midia) values ($1,$1,$1) returning id",
      [SLUG],
    );
    ambienteId = rows[0].id;
    for (const [tabela, valores] of [
      ["pilar", "'decisao','Decisão','Quem decide precisa de critério.',1"],
      ["publico", "'investidor','Investidor','Compra para rentabilizar.'"],
    ] as const) {
      await dono(
        `begin; select set_config('app.ambiente', '${ambienteId}', true);
         insert into ${tabela} (ambiente_id, slug, nome, corpo${tabela === "pilar" ? ", ordem" : ""})
         values ('${ambienteId}', ${valores}); commit`,
      );
    }
  });

  afterAll(async () => {
    await dono("delete from ambiente where slug = $1", [SLUG]);
    await encerrarPool();
  });

  it("registra a publicação com a URL e move para publicado", async () => {
    const slug = `${SLUG}-ok`;
    const id = await semearBrief(slug, "pendente-publicacao");
    const quando = new Date("2026-08-19T14:00:00.000Z");

    await backendPostgres(ambienteId).marcarPublicado(slug, {
      igPostUrl: "https://www.instagram.com/p/DXk2f9mAvz1/",
      publicadoEm: quando,
    });

    const [linha] = await noAmbiente(
      `select estado, ig_post_url, publicado_em from brief where id = $1`,
      [id],
    );
    expect(linha.estado).toBe("publicado");
    expect(linha.ig_post_url).toBe("https://www.instagram.com/p/DXk2f9mAvz1/");
    expect(new Date(linha.publicado_em).toISOString()).toBe(
      quando.toISOString(),
    );

    // Sem o evento, o acervo mostraria o estado sem saber quando nem por quem —
    // e a anti-repetição perde a linha do tempo.
    const [evento] = await noAmbiente(
      `select tipo, de_estado, para_estado, extra from evento where brief_id = $1`,
      [id],
    );
    expect(evento.tipo).toBe("published");
    expect(evento.de_estado).toBe("pendente-publicacao");
    expect(evento.extra.ig_post_url).toContain("instagram.com");
  });

  it("a direção de arte chega à tela com as chaves que ela lê", async () => {
    // O banco guarda `must_have`, o app fala `mustHave`. Havia um cast cru no
    // meio: os tipos batiam, a tela recebia chaves desconhecidas e mostrava
    // direção de arte vazia com o dado inteiro gravado. Cast não converte.
    const slug = `${SLUG}-visual`;
    await semearBrief(slug, "pendente-aprovacao");

    const brief = await backendPostgres(ambienteId).buscarBrief(
      slug,
      "pendente-aprovacao",
    );
    expect(brief.visualBrief?.mustHave).toEqual(["mapa"]);
    expect(brief.visualBrief?.avoidVisual).toEqual(["stock genérico"]);
    expect(brief.visualBrief?.aspectRatio).toBe("4:5");
  });

  it("recusa publicar o que não foi aprovado", async () => {
    const slug = `${SLUG}-cedo`;
    await semearBrief(slug, "pendente-aprovacao");

    // Publicar da fila puralaria a aprovação — o estado é o que registra que
    // alguém olhou o brief antes de ele virar post.
    await expect(
      backendPostgres(ambienteId).marcarPublicado(slug, {
        igPostUrl: "https://www.instagram.com/p/DXk2f9mAvz1/",
        publicadoEm: new Date(),
      }),
    ).rejects.toBeInstanceOf(StoreError);
  });

  it("exporta um .md com copy, direção visual e a URL da hero", async () => {
    const slug = `${SLUG}-pacote`;
    const id = await semearBrief(slug, "pendente-publicacao");

    const { nome, conteudo } = await backendPostgres(ambienteId).exportar(slug);

    expect(nome).toBe(`${slug}.md`);
    expect(conteudo).toContain("Lote na RMBH com escritura");
    expect(conteudo).toContain("carrossel-comparativo");
    expect(conteudo).toContain("Chama no WhatsApp");
    expect(conteudo).toContain("stock genérico");
    // A hero decidida vira URL do Cloudinary: depois do upload ela não é mais
    // arquivo, e é por isso que o pacote cabe num documento só.
    expect(conteudo).toContain("https://res.cloudinary.com/x/hero-0.jpg");
    expect(conteudo).toContain(
      "escritura é o critério de decisão do ICP investidor",
    );

    const [linha] = await noAmbiente(
      `select handoff_em from brief where id = $1`,
      [id],
    );
    expect(linha.handoff_em).not.toBeNull();

    const [evento] = await noAmbiente(
      `select tipo, extra from evento where brief_id = $1 and tipo = 'handoff-finished'`,
      [id],
    );
    expect(evento.extra.hero_choice).toBe(0);
  });

  it("diz no pacote quando não há foto, em vez de omitir a linha", async () => {
    const slug = `${SLUG}-sem-foto`;
    const id = await semearBrief(slug, "pendente-publicacao");
    await noAmbiente("update brief set hero_indice = null where id = $1", [id]);

    // Ausência de foto é decisão válida — o Smart Design gera a arte. Omitir a
    // linha faria "sem foto" parecer "esquecemos de resolver a hero".
    const { conteudo } = await backendPostgres(ambienteId).exportar(slug);
    expect(conteudo).toContain("sem foto");
  });
});
