import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { bancoDisponivel } from "./teste-banco";
import { backendPostgres } from "./backend";
import { encerrarPool } from "./cliente";
import { loadManifest, resolvePaths } from "../lib/manifest";

/**
 * A mídia é o único dado do sistema que não vive no banco — e por isso é o
 * único que o row-level security não protege sozinho.
 *
 * Brief, vault, configuração e fila são isolados por construção: a consulta
 * declara o ambiente e o Postgres recusa o resto. O arquivo não passa por
 * consulta nenhuma, então o isolamento dele precisa ser afirmado aqui.
 */

const disponivel = await bancoDisponivel();

const A = "teste-midia-a";
const B = "teste-midia-b";
const ids: Record<string, string> = {};
const ARQUIVO = "foto-confidencial-do-b.jpg";
let criados: string[] = [];

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

describe.skipIf(!disponivel)("isolamento da mídia", () => {
  beforeAll(async () => {
    for (const slug of [A, B]) {
      await dono("delete from ambiente where slug = $1", [slug]);
      const rows = await dono(
        "insert into ambiente (slug, nome, prefixo_midia) values ($1,$1,$2) returning id",
        [slug, `midia/${slug}`],
      );
      ids[slug] = rows[0].id;
      await noAmbiente(
        slug,
        `insert into pilar (ambiente_id, slug, nome, corpo, ordem) values ($1,'p','P','x',1)`,
        [ids[slug]],
      );
      await noAmbiente(
        slug,
        `insert into publico (ambiente_id, slug, nome, corpo) values ($1,'q','Q','x')`,
        [ids[slug]],
      );
    }

    // A foto pertence ao ambiente B, e só a ele.
    const b = await noAmbiente(
      B,
      `insert into brief (ambiente_id, slug, brief_id, estado, pilar_slug, publico_slug, headline, topic_hash)
       values ($1,'brief-do-b','W34-960','pendente-aprovacao','p','q','H','hash-b') returning id`,
      [ids[B]],
    );
    await noAmbiente(
      B,
      `insert into brief_candidata (ambiente_id, brief_id, indice, objeto_path)
       values ($1,$2,0,$3)`,
      [ids[B], b[0].id, ARQUIVO],
    );

    const store = backendPostgres(ids[B]);
    const destino = await store.caminhoMidia("pendente-aprovacao", ARQUIVO);
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, Buffer.from("conteúdo confidencial do B"));
    criados = [destino];
  });

  afterAll(async () => {
    for (const f of criados) await rm(f, { force: true });
    if (disponivel) {
      for (const slug of [A, B]) {
        await dono("delete from ambiente where slug = $1", [slug]);
      }
    }
    await encerrarPool();
  });

  it("o dono da foto continua conseguindo lê-la", async () => {
    const bytes = await backendPostgres(ids[B]).lerMidia(
      "pendente-aprovacao",
      ARQUIVO,
    );
    expect(Buffer.from(bytes!).toString()).toContain("confidencial");
  });

  it("um ambiente não lê a mídia de outro, mesmo sabendo o nome do arquivo", async () => {
    // O nome do arquivo é adivinhável: sai do brief_ref, que cada ambiente
    // numera do 1. Dois clientes chegam a `2026-W34-001_...` na mesma semana.
    // Se o caminho for a única defesa, basta conhecer o nome para ler.
    const bytes = await backendPostgres(ids[A]).lerMidia(
      "pendente-aprovacao",
      ARQUIVO,
    );
    expect(bytes).toBeNull();
  });

  it("nem a foto no diretório antigo, compartilhado, vaza para outro ambiente", async () => {
    // Este é o caso em que o caminho **não** separa nada: a mídia dos briefs
    // importados está num diretório único, e ela não vai migrar de lá porque
    // store/ é a fotografia congelada da importação. Aqui a única defesa é a
    // consulta — só entrega bytes de arquivo que pertence a um brief que o RLS
    // deixa este ambiente enxergar.
    const legado = resolvePaths(await loadManifest()).mediaDir[
      "pendente-aprovacao"
    ];
    const nome = "foto-legada-do-b.jpg";
    await mkdir(legado, { recursive: true });
    await writeFile(path.join(legado, nome), Buffer.from("legado do B"));
    criados.push(path.join(legado, nome));

    await noAmbiente(
      B,
      `insert into brief_candidata (ambiente_id, brief_id, indice, objeto_path)
       values ($1, (select id from brief where slug = 'brief-do-b'), 1, $2)`,
      [ids[B], nome],
    );

    expect(
      await backendPostgres(ids[A]).lerMidia("pendente-aprovacao", nome),
    ).toBeNull();

    const doDono = await backendPostgres(ids[B]).lerMidia(
      "pendente-aprovacao",
      nome,
    );
    expect(Buffer.from(doDono!).toString()).toBe("legado do B");
  });

  it("cada ambiente tem seu próprio diretório de cache", async () => {
    // Sem separação, dois clientes com arquivo de mesmo nome se sobrescrevem —
    // e o segundo scan apaga a foto do primeiro sem aviso.
    const deA = await backendPostgres(ids[A]).caminhoMidia(
      "pendente-aprovacao",
      ARQUIVO,
    );
    const deB = await backendPostgres(ids[B]).caminhoMidia(
      "pendente-aprovacao",
      ARQUIVO,
    );
    expect(deA).not.toBe(deB);
  });

  it("o cache não vive dentro do store congelado", async () => {
    // store/ é a fotografia da importação e não é mais atualizado por nada;
    // gravar cache lá contradiz o LEIA-ME que está no próprio diretório.
    const p = await backendPostgres(ids[A]).caminhoMidia(
      "pendente-aprovacao",
      ARQUIVO,
    );
    const dirDoStore = resolvePaths(await loadManifest()).mediaDir[
      "pendente-aprovacao"
    ];
    expect(p.startsWith(dirDoStore)).toBe(false);
  });
});
