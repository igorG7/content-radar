import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { backendPostgres } from "./backend";
import { encerrarPool } from "./cliente";

/**
 * A purga do cache local.
 *
 * O que se exige dela é sobretudo o que ela **não** faz: mídia de brief que
 * ainda não saiu, mídia recém-publicada, e — acima de tudo — mídia cuja única
 * cópia é a local. Apagar essa última não libera disco, perde a foto.
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

const SLUG = "teste-purga";
let ambienteId = "";
const criados: string[] = [];

async function dono(q: string, p: unknown[] = []) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_MIGRATIONS,
  });
  const { rows } = await pool.query(q, p);
  await pool.end();
  return rows;
}

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

/**
 * Um brief com foto no disco. `publicadoHa` em dias decide se ele cai na janela;
 * `naNuvem` decide se a cópia local é descartável ou única.
 */
async function semear(
  slug: string,
  estado: "pendente-aprovacao" | "publicado",
  opcoes: { publicadoHa?: number; naNuvem: boolean },
) {
  const [b] = await noAmbiente(
    `insert into brief (ambiente_id, slug, brief_id, estado, pilar_slug, publico_slug,
       headline, topic_hash, publicado_em)
     values ($1,$2,$3,$4,'p','q','H',$5,
       case when $6::int is null then null else now() - make_interval(days => $6::int) end)
     returning id`,
    [
      ambienteId,
      slug,
      `W34-${slug.slice(-3)}`,
      estado,
      `hash-${slug}`,
      opcoes.publicadoHa ?? null,
    ],
  );

  const arquivo = `${slug}.jpg`;
  const caminho = await backendPostgres(ambienteId).caminhoMidia(
    estado,
    arquivo,
  );
  await mkdir(path.dirname(caminho), { recursive: true });
  await writeFile(caminho, Buffer.alloc(1024, 1));
  criados.push(caminho);

  await noAmbiente(
    `insert into brief_candidata (ambiente_id, brief_id, indice, objeto_path, cloud_url)
     values ($1,$2,0,$3,$4)`,
    [
      ambienteId,
      b.id,
      arquivo,
      opcoes.naNuvem ? "https://res.cloudinary.com/x/y.jpg" : null,
    ],
  );
  return { id: b.id, caminho };
}

beforeAll(async () => {
  if (!disponivel) return;
  await dono("delete from ambiente where slug = $1", [SLUG]);
  const rows = await dono(
    "insert into ambiente (slug, nome, prefixo_midia) values ($1,$1,$2) returning id",
    [SLUG, `midia/${SLUG}`],
  );
  ambienteId = rows[0].id;
  await noAmbiente(
    `insert into pilar (ambiente_id, slug, nome, corpo, ordem) values ($1,'p','P','x',1)`,
    [ambienteId],
  );
  await noAmbiente(
    `insert into publico (ambiente_id, slug, nome, corpo) values ($1,'q','Q','x')`,
    [ambienteId],
  );
  await noAmbiente(
    `insert into config (ambiente_id, pesos, caps, janelas, volume)
     values ($1,'{}','{}','{}','{}')`,
    [ambienteId],
  );
});

afterAll(async () => {
  for (const c of criados) await rm(c, { force: true });
  if (disponivel) await dono("delete from ambiente where slug = $1", [SLUG]);
  await encerrarPool();
});

describe.skipIf(!disponivel)("purga do cache local", () => {
  it("apaga o que já está na nuvem e passou da janela", async () => {
    const { caminho } = await semear(`${SLUG}-velho`, "publicado", {
      publicadoHa: 60,
      naNuvem: true,
    });

    const r = await backendPostgres(ambienteId).purgarMidia();
    expect(r.apagados).toBe(1);
    expect(r.bytes).toBe(1024);
    expect(existsSync(caminho)).toBe(false);

    // O registro perde o caminho local: mantê-lo faria a tela pedir um arquivo
    // que não existe mais, em vez de usar a URL remota.
    const [c] = await noAmbiente(
      `select objeto_path, cloud_url from brief_candidata c
       join brief b on b.id = c.brief_id where b.slug = $1`,
      [`${SLUG}-velho`],
    );
    expect(c.objeto_path).toBeNull();
    expect(c.cloud_url).not.toBeNull();
  });

  it("preserva a foto cuja única cópia é a local", async () => {
    // Sem `cloud_url`, apagar não libera disco: perde a imagem. Era a regra
    // que a skill original chamava de "modo placeholder".
    const { caminho } = await semear(`${SLUG}-unico`, "publicado", {
      publicadoHa: 60,
      naNuvem: false,
    });

    const r = await backendPostgres(ambienteId).purgarMidia();
    expect(r.preservados).toBe(1);
    expect(r.apagados).toBe(0);
    expect(existsSync(caminho)).toBe(true);
  });

  it("não toca no que foi publicado há pouco", async () => {
    const { caminho } = await semear(`${SLUG}-novo`, "publicado", {
      publicadoHa: 3,
      naNuvem: true,
    });

    expect((await backendPostgres(ambienteId).purgarMidia()).apagados).toBe(0);
    expect(existsSync(caminho)).toBe(true);
  });

  it("não toca no que ainda não foi publicado", async () => {
    // A pauta ainda vai ser trabalhada; a foto é dela.
    const { caminho } = await semear(`${SLUG}-fila`, "pendente-aprovacao", {
      naNuvem: true,
    });

    expect((await backendPostgres(ambienteId).purgarMidia()).apagados).toBe(0);
    expect(existsSync(caminho)).toBe(true);
  });

  it("em ensaio conta sem apagar", async () => {
    // Saber quanto seria liberado antes de liberar — a skill original tinha
    // `--dry-run` pelo mesmo motivo.
    const { caminho } = await semear(`${SLUG}-ensaio`, "publicado", {
      publicadoHa: 60,
      naNuvem: true,
    });

    const r = await backendPostgres(ambienteId).purgarMidia({ ensaio: true });
    expect(r.apagados).toBe(1);
    expect(existsSync(caminho)).toBe(true);

    const [c] = await noAmbiente(
      `select objeto_path from brief_candidata c
       join brief b on b.id = c.brief_id where b.slug = $1`,
      [`${SLUG}-ensaio`],
    );
    expect(c.objeto_path).not.toBeNull();
  });

  it("respeita a janela configurada pelo ambiente", async () => {
    await noAmbiente(`update config set janelas = '{"purga_local_dias": 365}'`);
    const { caminho } = await semear(`${SLUG}-janela`, "publicado", {
      publicadoHa: 60,
      naNuvem: true,
    });

    // 60 dias passa dos 30 padrão, mas não dos 365 declarados.
    expect((await backendPostgres(ambienteId).purgarMidia()).apagados).toBe(0);
    expect(existsSync(caminho)).toBe(true);
    await noAmbiente(`update config set janelas = '{}'`);
  });
});
