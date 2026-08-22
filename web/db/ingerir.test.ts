import { describe, expect, it, afterAll, beforeAll } from "vitest";
import { mkdir, writeFile, appendFile, rm } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { materializar, descartar, type Workspace } from "./workspace";
import { ingerir } from "./ingerir";
import { encerrarPool } from "./cliente";

/**
 * A ingestão fecha o ciclo: o que a execução escreveu no workspace volta para o
 * banco. O que se exige dela é atomicidade e recusa — brief com referência que
 * não existe não entra, e nem os eventos entram junto.
 */

const disponivel = await (async () => {
  if (!process.env.DATABASE_URL_MIGRATIONS) return false;
  const sonda = new Pool({
    connectionString: process.env.DATABASE_URL_MIGRATIONS,
  });
  try {
    const { rows } = await sonda.query(
      "select count(*)::int n from ambiente where slug='avanz-imoveis'",
    );
    return rows[0].n > 0;
  } catch {
    return false;
  } finally {
    await sonda.end();
  }
})();

let ambienteId = "";
const criados: Workspace[] = [];

/** Escreve no workspace o que uma execução deixaria. */
async function simularSaida(
  ws: Workspace,
  brief: Record<string, unknown>,
  eventos: Record<string, unknown>[],
) {
  const fm = Object.entries(brief)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join("\n");
  await writeFile(
    path.join(ws.dir, "store/briefs/pendente-aprovacao", `${brief.slug}.md`),
    `---\n${fm}\n---\n\nCorpo do brief escrito pelo briefer.\n`,
    "utf8",
  );
  for (const e of eventos) {
    await appendFile(
      path.join(ws.dir, "store/ledger.jsonl"),
      JSON.stringify(e) + "\n",
      "utf8",
    );
  }
}

/** Lê linhas com o ambiente declarado — sob FORCE RLS o dono não vê nada sem. */
async function noAmbiente(sql: string): Promise<Record<string, unknown>[]> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_MIGRATIONS,
  });
  await pool.query("begin");
  await pool.query("select set_config('app.ambiente', $1, true)", [ambienteId]);
  const { rows } = await pool.query(sql);
  await pool.query("commit");
  await pool.end();
  return rows;
}

async function contar(sql: string): Promise<number> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_MIGRATIONS,
  });
  await pool.query("begin");
  await pool.query("select set_config('app.ambiente', $1, true)", [ambienteId]);
  const { rows } = await pool.query(sql);
  await pool.query("commit");
  await pool.end();
  return Number(rows[0].n);
}

beforeAll(async () => {
  if (!disponivel) return;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_MIGRATIONS,
  });
  const { rows } = await pool.query(
    "select id from ambiente where slug='avanz-imoveis'",
  );
  ambienteId = rows[0].id;

  // Limpa antes, não só depois: uma execução que morre no meio deixa resto, e
  // o teste seguinte falharia por conflito de chave em vez de por defeito.
  await pool.query("begin");
  await pool.query("select set_config('app.ambiente', $1, true)", [ambienteId]);
  await pool.query("delete from brief where brief_id like '2026-W98-%'");
  await pool.query("delete from evento where ator = 'teste:ingestao'");
  await pool.query("commit");
  await pool.end();
});

afterAll(async () => {
  if (disponivel) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL_MIGRATIONS,
    });
    await pool.query("begin");
    await pool.query("select set_config('app.ambiente', $1, true)", [
      ambienteId,
    ]);
    await pool.query("delete from brief where brief_id like '2026-W98-%'");
    await pool.query("delete from evento where ator = 'teste:ingestao'");
    await pool.query("commit");
    await pool.end();
    for (const ws of criados) await descartar(ws);
  }
  await encerrarPool();
});

describe.skipIf(!disponivel)("ingestão", () => {
  it("traz brief, candidatas e eventos numa transação", async () => {
    const ws = await materializar(ambienteId);
    criados.push(ws);

    await mkdir(path.join(ws.dir, "store/media/pendente-aprovacao"), {
      recursive: true,
    });
    await writeFile(
      path.join(ws.dir, "store/media/pendente-aprovacao/foto.jpg"),
      "bytes",
      "utf8",
    );

    await simularSaida(
      ws,
      {
        brief_id: "2026-W98-001",
        slug: "2026-W98-001_teste",
        headline: "Uma headline de teste",
        pillar: "decisao-inteligente",
        icp: "comprador",
        topic_hash: "hash-de-teste-001",
        why_match: "banco §B10 (construir vs comprar)",
        hero_image_candidates: [
          { index: 0, local_path: "./store/media/pendente-aprovacao/foto.jpg" },
        ],
      },
      [
        {
          ts: new Date().toISOString(),
          event: "scan-started",
          actor: "teste:ingestao",
        },
        {
          ts: new Date().toISOString(),
          event: "brief-created",
          actor: "teste:ingestao",
          brief_id: "2026-W98-001",
        },
      ],
    );

    const r = await ingerir(ws);
    expect(r.briefs).toBe(1);
    expect(r.candidatas).toBe(1);
    expect(r.eventos).toBe(2);
    expect(r.midiaCopiada).toBe(1);

    expect(
      await contar(
        "select count(*)::int n from brief where brief_id='2026-W98-001'",
      ),
    ).toBe(1);
    // O evento ficou ligado ao brief pelo id do banco, não pela referência textual.
    expect(
      await contar(
        "select count(*)::int n from evento e join brief b on b.id=e.brief_id where b.brief_id='2026-W98-001'",
      ),
    ).toBe(1);
  });

  it("o brief entra sem decisão de arte registrada", async () => {
    // O briefer grava o padrão; ninguém decidiu. É a distinção que o arquivo
    // não conseguia fazer e que a fila depende para não liberar aprovação.
    expect(
      await contar(
        "select count(*)::int n from brief where brief_id='2026-W98-001' and hero_decidido_em is null",
      ),
    ).toBe(1);
  });

  it("recusa brief que cita tema inexistente, e nem os eventos entram", async () => {
    const ws = await materializar(ambienteId);
    criados.push(ws);

    await simularSaida(
      ws,
      {
        brief_id: "2026-W98-002",
        slug: "2026-W98-002_ruim",
        headline: "Cita tema que não existe",
        pillar: "decisao-inteligente",
        icp: "comprador",
        topic_hash: "hash-de-teste-002",
        why_match: "banco §Z99 (inventado)",
      },
      [
        {
          ts: new Date().toISOString(),
          event: "scan-started",
          actor: "teste:ingestao",
        },
      ],
    );

    const antesEventos = await contar("select count(*)::int n from evento");
    await expect(ingerir(ws)).rejects.toThrow(/recusada/i);

    expect(
      await contar(
        "select count(*)::int n from brief where brief_id='2026-W98-002'",
      ),
    ).toBe(0);
    // Ledger registrando um scan cujos briefs não existem descreveria algo que
    // não aconteceu.
    expect(await contar("select count(*)::int n from evento")).toBe(
      antesEventos,
    );
  });

  it("lê o brief do .json, com os campos que o markdown perdia", async () => {
    // Duas execuções reais gravaram formatos diferentes de .md: numa, hook,
    // CTA, hashtags e direção de arte foram para o frontmatter; na outra, para
    // o corpo. O .json é o objeto do briefer gravado como veio — não depende
    // de o modelo decidir onde põe cada campo.
    const ws = await materializar(ambienteId);
    criados.push(ws);
    await writeFile(
      path.join(
        ws.dir,
        "store/briefs/pendente-aprovacao",
        "2026-W98-006_do-json.json",
      ),
      JSON.stringify({
        brief_id: "2026-W98-006",
        slug: "2026-W98-006_do-json",
        headline: "Veio do JSON",
        hook: "Um hook",
        caption_draft: "Parágrafo um.\n\nParágrafo dois.",
        cta: "Chama no WhatsApp",
        hashtags: ["avanzimoveis", "rmbh"],
        pillar: "decisao-inteligente",
        icp: "comprador",
        topic_hash: "hash-do-json",
        why_match: "casa com o pilar",
        od_skill_ref: "ad-creative",
        visual_brief: { must_have: ["logo"], avoid_visual: ["stock"] },
      }),
      "utf8",
    );

    const r = await ingerir(ws);
    expect(r.briefs).toBe(1);
    // Os campos de prosa livre — que o markdown perdia — chegaram todos. O
    // aviso de imagem é outro assunto: este fixture não tem candidata.
    expect(r.avisos.map((a) => a.detalhe)).toEqual([
      "sem candidatas de imagem",
    ]);

    const [linha] = await noAmbiente(
      `select hook, caption_draft, cta, hashtags, visual_brief, destino_od
       from brief where brief_id = '2026-W98-006'`,
    );
    expect(String(linha.caption_draft)).toContain("Parágrafo dois");
    expect(linha.cta).toBe("Chama no WhatsApp");
    expect(linha.hashtags).toEqual(["avanzimoveis", "rmbh"]);
    expect((linha.visual_brief as { must_have: string[] }).must_have).toEqual([
      "logo",
    ]);
    expect((linha.destino_od as { od_skill_ref: string }).od_skill_ref).toBe(
      "ad-creative",
    );
  });

  it("avisa quando teve de cair para o markdown", async () => {
    const ws = await materializar(ambienteId);
    criados.push(ws);
    await simularSaida(
      ws,
      {
        brief_id: "2026-W98-007",
        slug: "2026-W98-007_do-md",
        headline: "Veio do markdown",
        pillar: "decisao-inteligente",
        icp: "comprador",
        topic_hash: "hash-do-md",
      },
      [],
    );

    const r = await ingerir(ws);
    expect(r.avisos.map((a) => a.detalhe)).toContain(
      "lido do markdown, não do .json — campos podem ter ficado no corpo",
    );
  });

  it("aceita brief sem legenda, mas avisa", async () => {
    // O primeiro scan bem-sucedido entregou exatamente isto: tudo preenchido
    // menos a legenda. Recusar jogaria fora 25 minutos por um campo que dá
    // para escrever à mão; aceitar calado foi como ninguém notou até abrir a
    // tela.
    const ws = await materializar(ambienteId);
    criados.push(ws);
    await simularSaida(
      ws,
      {
        brief_id: "2026-W98-005",
        slug: "2026-W98-005_sem-legenda",
        headline: "Sem legenda",
        pillar: "decisao-inteligente",
        icp: "comprador",
        topic_hash: "hash-sem-legenda",
      },
      [],
    );

    const r = await ingerir(ws);
    expect(r.briefs).toBe(1);
    expect(r.recusas).toEqual([]);
    expect(r.avisos.map((a) => a.detalhe)).toContain("sem rascunho de legenda");

    // E fica no brief, não só no relatório: o aviso precisa sobreviver à
    // varredura que o produziu.
    const [linha] = await noAmbiente(
      `select avisos from brief where brief_id = '2026-W98-005'`,
    );
    expect(linha.avisos).toContain("sem rascunho de legenda");
  });

  it("relata o aborto que a própria skill declarou", async () => {
    // A primeira execução real terminou assim: o researcher não teve busca
    // disponível, devolveu zero achados e a skill abortou — sem exceção
    // nenhuma. O executor gravou "concluído" 58 segundos depois do
    // `scan-aborted` da skill, e o banco passou a contradizer o ledger.
    const ws = await materializar(ambienteId);
    criados.push(ws);

    await appendFile(
      path.join(ws.dir, "store/ledger.jsonl"),
      JSON.stringify({
        ts: new Date().toISOString(),
        event: "scan-aborted",
        actor: "teste:ingestao",
        scan_id: "2026-W98-scan-042",
        extra: { detail: "WebSearch indisponível", briefs_created: 0 },
      }) + "\n",
      "utf8",
    );

    const r = await ingerir(ws);
    expect(r.briefs).toBe(0);
    expect(r.abortadaPelaSkill?.motivo).toBe("WebSearch indisponível");
  });

  it("uma varredura que produziu brief não é dada como abortada", async () => {
    const ws = await materializar(ambienteId);
    criados.push(ws);
    await simularSaida(
      ws,
      {
        brief_id: "2026-W98-004",
        slug: "2026-W98-004_saida-boa",
        headline: "Saída boa",
        pillar: "decisao-inteligente",
        icp: "comprador",
        topic_hash: "hash-saida-boa",
      },
      [
        {
          ts: new Date().toISOString(),
          event: "scan-finished",
          actor: "teste:ingestao",
          scan_id: "2026-W98-scan-043",
        },
      ],
    );

    expect((await ingerir(ws)).abortadaPelaSkill).toBeNull();
  });

  it("recusa pilar que saiu do vault", async () => {
    const ws = await materializar(ambienteId);
    criados.push(ws);
    await simularSaida(
      ws,
      {
        brief_id: "2026-W98-003",
        slug: "2026-W98-003_pilar",
        headline: "Pilar que não existe",
        pillar: "pilar-inventado",
        icp: "comprador",
        topic_hash: "hash-003",
      },
      [],
    );
    await expect(ingerir(ws)).rejects.toThrow(/recusada/i);
  });
});
