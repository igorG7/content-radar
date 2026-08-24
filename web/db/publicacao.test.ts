import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { bancoDisponivel } from "./teste-banco";
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

const disponivel = await bancoDisponivel();

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
         '{"why_match":"escritura é o critério de decisão do ICP investidor",
           "source_urls":["https://exemplo.test/fonte"]}'
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
      // Com `template`: é de lá que sai o formato da peça, como nos pilares
      // reais da Avanz.
      [
        "pilar",
        `'decisao','Decisão','Quem decide precisa de critério.',1,
         '{"formato":{"proporcao":"1:1","dimensao":"1080x1080"},
           "regras_obrigatorias":["respeitar a paleta oficial"]}'`,
      ],
      ["publico", "'investidor','Investidor','Compra para rentabilizar.'"],
    ] as const) {
      await dono(
        `begin; select set_config('app.ambiente', '${ambienteId}', true);
         insert into ${tabela} (ambiente_id, slug, nome, corpo${tabela === "pilar" ? ", ordem, template" : ""})
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
    // A proporção vem do template do pilar, não do visual_brief: é lá que o
    // dado existe, e foi o que o pacote antigo usava.
    expect(conteudo).toContain("1:1");
    // E de onde a copy saiu, para conferir se um número é real.
    expect(conteudo).toContain("https://exemplo.test/fonte");

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

  it("não repete hook e CTA que já estão dentro da legenda", async () => {
    // A legenda abre com o hook e fecha com o CTA, por especificação. Rotular
    // os dois e imprimir a legenda inteira mostrava o mesmo texto duas vezes.
    const slug = `${SLUG}-sem-repetir`;
    const id = await semearBrief(slug, "pendente-publicacao");
    await noAmbiente(
      `update brief set hook = 'Abre assim.', cta = 'Fecha assim.',
       caption_draft = 'Abre assim.

Meio da legenda.

Fecha assim.' where id = $1`,
      [id],
    );

    const { conteudo } = await backendPostgres(ambienteId).exportar(slug);
    expect(conteudo).not.toContain("**Hook:**");
    expect(conteudo).not.toContain("**CTA:**");
    // A legenda sai íntegra: é ela que a pessoa cola no Instagram.
    expect(conteudo).toContain("Abre assim.");
    expect(conteudo).toContain("Fecha assim.");
  });

  it("não perde hook nem CTA quando a legenda não os contém", async () => {
    // A legenda deveria abrir com o hook e fechar com o CTA. Quando não abre
    // nem fecha, omiti-los perderia a chamada para ação — que é o que converte.
    const slug = `${SLUG}-com-rotulo`;
    const id = await semearBrief(slug, "pendente-publicacao");
    await noAmbiente(
      `update brief set hook = 'Um hook à parte', cta = 'Manda mensagem',
       caption_draft = 'Uma legenda que não cita nenhum dos dois.' where id = $1`,
      [id],
    );

    const { conteudo } = await backendPostgres(ambienteId).exportar(slug);
    expect(conteudo).toContain("Um hook à parte");
    expect(conteudo).toContain("Manda mensagem");
  });

  it("não aninha negrito ao citar o pilar", async () => {
    // O corpo do pilar da Avanz começa com "**Tese:** ...". Embutir isso dentro
    // de outra frase em negrito produzia `**nome** — **Tese:** ...`, que o
    // markdown renderiza torto.
    const slug = `${SLUG}-pilar-negrito`;
    await semearBrief(slug, "pendente-publicacao");
    await noAmbiente(
      `update pilar set corpo = '**Tese:** ensinar o cliente a comprar bem.'
       where slug = 'decisao'`,
    );

    const { conteudo } = await backendPostgres(ambienteId).exportar(slug);
    expect(conteudo).toContain("— Tese: ensinar o cliente");
    expect(conteudo).not.toContain("— **Tese:**");
  });

  it("não anuncia formato quando o pilar não tem template", async () => {
    // Cliente que ainda não configurou a base visual do pilar. "Formato: —"
    // faria o pacote prometer um dado que ninguém produziu.
    //
    // Pilar próprio em vez de apagar o template do outro: mutar estado que os
    // demais testes usam e restaurar depois é a receita para uma falha que só
    // aparece quando alguém reordena.
    await noAmbiente(
      `insert into pilar (ambiente_id, slug, nome, corpo, ordem)
       values ($1,'sem-modelo','Sem modelo','x',9)`,
      [ambienteId],
    );
    const slug = `${SLUG}-sem-formato`;
    const id = await semearBrief(slug, "pendente-publicacao");
    await noAmbiente(
      "update brief set pilar_slug = 'sem-modelo', visual_brief = '{}' where id = $1",
      [id],
    );

    const { conteudo } = await backendPostgres(ambienteId).exportar(slug);
    expect(conteudo).not.toContain("**Formato:**");
  });

  it("o bloco para colar leva guardrails e regras do pilar", async () => {
    // É o que impede a arte de prometer o que a marca não promete. Estavam no
    // banco e não chegavam ao pacote — quem gera a peça não tinha como saber.
    await noAmbiente(
      `insert into guardrail (ambiente_id, slug, corpo)
       values ($1,'nao-prometer','nunca prometer aprovação garantida')
       on conflict do nothing`,
      [ambienteId],
    );
    const slug = `${SLUG}-guardrails`;
    await semearBrief(slug, "pendente-publicacao");

    const { conteudo } = await backendPostgres(ambienteId).exportar(slug);
    expect(conteudo).toContain("GUARDRAILS DA MARCA");
    expect(conteudo).toContain("nunca prometer aprovação garantida");
    expect(conteudo).toContain("REGRAS DO PILAR");
    expect(conteudo).toContain("respeitar a paleta oficial");
  });

  it("o bloco para colar traz tudo o que a peça precisa, de uma vez", async () => {
    // A razão de o pacote existir: um bloco só, em vez de sete seções para
    // alguém montar o prompt de cabeça — e perder um item no caminho.
    const slug = `${SLUG}-bloco`;
    await semearBrief(slug, "pendente-publicacao");

    const { conteudo } = await backendPostgres(ambienteId).exportar(slug);
    const bloco = conteudo.split("```")[1] ?? "";
    for (const parte of [
      "HEADLINE",
      "CAPTION",
      "HASHTAGS",
      "ARTE",
      "MUST-HAVE",
      "EVITAR",
    ]) {
      expect(bloco).toContain(parte);
    }
    expect(bloco).toContain("Lote na RMBH com escritura");
    expect(bloco).toContain("mapa");
  });

  it("leva ao pacote o que precisa ser conferido antes de publicar", async () => {
    // Três origens, uma seção: o que a ingestão achou pendente, o
    // envelhecimento calculado e a nota de quem revisou. Espalhadas, nenhuma
    // delas chega a quem faz a peça.
    const slug = `${SLUG}-atencao`;
    const id = await semearBrief(slug, "pendente-publicacao");
    await noAmbiente(
      `update brief set avisos = '["sem candidatas de imagem"]',
       review_notes = 'confirmar o percentual com a fonte',
       criado_em = now() - interval '40 days' where id = $1`,
      [id],
    );

    const { conteudo } = await backendPostgres(ambienteId).exportar(slug);
    expect(conteudo).toContain("## Pontos de atenção");
    expect(conteudo).toContain("sem candidatas de imagem");
    expect(conteudo).toContain("confirmar o percentual com a fonte");
    expect(conteudo).toContain("40 dias");
  });

  it("não abre seção de atenção quando não há o que conferir", async () => {
    // Seção vazia com "nada a relatar" treina a pessoa a ignorar a seção — e
    // aí ela ignora quando houver algo.
    const slug = `${SLUG}-sem-atencao`;
    await semearBrief(slug, "pendente-publicacao");

    const { conteudo } = await backendPostgres(ambienteId).exportar(slug);
    expect(conteudo).not.toContain("## Pontos de atenção");
  });

  it("reexportar não move a data da entrega", async () => {
    // Baixar o arquivo de novo — para refazer a arte, conferir, ou porque o
    // pacote mudou — não é entregar de novo. Sobrescrever `handoff_em` faria a
    // data da entrega andar para frente sem nada ter acontecido.
    const slug = `${SLUG}-reexporta`;
    const id = await semearBrief(slug, "pendente-publicacao");
    const store = backendPostgres(ambienteId);

    await store.exportar(slug);
    const [primeira] = await noAmbiente(
      "select handoff_em from brief where id = $1",
      [id],
    );

    await store.exportar(slug);
    const [segunda] = await noAmbiente(
      "select handoff_em from brief where id = $1",
      [id],
    );
    expect(String(segunda.handoff_em)).toBe(String(primeira.handoff_em));

    const eventos = await noAmbiente(
      `select tipo from evento where brief_id = $1
       and tipo in ('handoff-finished','handoff-reexportado') order by ts`,
      [id],
    );
    expect(eventos.map((e) => e.tipo)).toEqual([
      "handoff-finished",
      "handoff-reexportado",
    ]);
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

  it("editar a copy vira evento, com o que havia antes", async () => {
    /**
     * O ledger registrava transição de estado e não mudança de conteúdo, então
     * o texto que ia ao Instagram podia diferir do que o pipeline escreveu sem
     * nada dizer. Aconteceu de verdade: o CTA do `2026-W35-001` saiu quebrado
     * ("se esse caminha pra você"), foi corrigido à mão antes de publicar, e o
     * histórico não tem uma linha sobre isso.
     *
     * O valor anterior é o que responde depois: o agente escreveu isto, ou
     * fomos nós?
     */
    const slug = `${SLUG}-editado`;
    await semearBrief(slug, "pendente-aprovacao");
    const store = backendPostgres(ambienteId);

    await store.editarBrief("pendente-aprovacao", slug, {
      cta: "Fala com a gente no WhatsApp",
    });

    const [evento] = await noAmbiente(
      `select e.tipo, e.extra from evento e join brief b on b.id = e.brief_id
       where b.slug = $1 and e.tipo = 'brief-corrected'`,
      [slug],
    );
    expect(evento).toBeDefined();
    expect((evento.extra as { campos: string[] }).campos).toEqual(["cta"]);
    expect((evento.extra as { antes: { cta: string } }).antes.cta).toBe(
      "Chama no WhatsApp",
    );
  });

  it("salvar sem mudar nada não vira evento", async () => {
    // Abrir o editor e fechar é gesto de interface, não fato editorial. Registrar
    // encheria o histórico de linhas que não dizem nada.
    const slug = `${SLUG}-intocado`;
    await semearBrief(slug, "pendente-aprovacao");
    const store = backendPostgres(ambienteId);

    await store.editarBrief("pendente-aprovacao", slug, {
      cta: "Chama no WhatsApp",
    });

    const linhas = await noAmbiente(
      `select 1 from evento e join brief b on b.id = e.brief_id
       where b.slug = $1 and e.tipo = 'brief-corrected'`,
      [slug],
    );
    expect(linhas).toHaveLength(0);
  });

  it("corrigir o CTA corrige a cópia dele dentro da legenda", async () => {
    /**
     * O briefer escreve o CTA duas vezes: campo e último parágrafo da legenda.
     * Editar só o campo deixava as duas discordando, e o pacote saía com as
     * duas — a errada dentro do bloco que se cola no Instagram.
     */
    const slug = `${SLUG}-cta-na-legenda`;
    await semearBrief(slug, "pendente-aprovacao");
    const store = backendPostgres(ambienteId);

    // A legenda semeada termina com o CTA, como o briefer escreve.
    await store.editarBrief("pendente-aprovacao", slug, {
      caption_draft: "Corpo da legenda.\n\nChama no WhatsApp",
    });
    await store.editarBrief("pendente-aprovacao", slug, {
      cta: "Fala com a gente no WhatsApp",
    });

    const [b] = await noAmbiente(
      "select caption_draft, cta from brief where slug = $1",
      [slug],
    );
    expect(b.cta).toBe("Fala com a gente no WhatsApp");
    expect(b.caption_draft).toBe(
      "Corpo da legenda.\n\nFala com a gente no WhatsApp",
    );
  });

  it("não mexe na legenda que não terminava com o CTA", async () => {
    // Só propaga cópia literal. Reescrever texto que a pessoa escreveu de outro
    // jeito seria editar por conta própria.
    const slug = `${SLUG}-cta-solto`;
    await semearBrief(slug, "pendente-aprovacao");
    const store = backendPostgres(ambienteId);

    await store.editarBrief("pendente-aprovacao", slug, {
      caption_draft: "Legenda que termina de outro jeito.",
    });
    await store.editarBrief("pendente-aprovacao", slug, {
      cta: "Fala com a gente no WhatsApp",
    });

    const [b] = await noAmbiente(
      "select caption_draft from brief where slug = $1",
      [slug],
    );
    expect(b.caption_draft).toBe("Legenda que termina de outro jeito.");
  });
});
