import { describe, expect, it, afterAll } from "vitest";
import { Pool } from "pg";
import { bancoDisponivel } from "./teste-banco";
import { cadastrar } from "../lib/cadastro";
import { encerrarPool } from "./cliente";

/**
 * O cadastro é a porta de entrada de quem não tem acesso ao servidor. O que se
 * exige dele: que crie um ambiente utilizável, que não deixe dois clientes
 * dividirem endereço, e que recuse antes de criar meio ambiente.
 */

const disponivel = await bancoDisponivel();

const criados: string[] = [];
afterAll(async () => {
  if (criados.length > 0) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query("delete from ambiente where slug = any($1::text[])", [
      criados,
    ]);
    await pool.end();
  }
  await encerrarPool();
});

/** Nome único por execução: a suíte roda repetida no mesmo banco. */
const nomeDe = (que: string) => `Teste Cadastro ${que} ${process.pid}`;

async function comAmbiente(slug: string, sql: string) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows: amb } = await pool.query(
      "select id from ambiente where slug = $1",
      [slug],
    );
    await pool.query("begin");
    await pool.query("select set_config('app.ambiente', $1, true)", [
      amb[0].id,
    ]);
    const { rows } = await pool.query(sql);
    await pool.query("commit");
    return rows;
  } finally {
    await pool.end();
  }
}

describe.skipIf(!disponivel)("cadastro de cliente", () => {
  it("cria ambiente utilizável e deixa a pessoa logada", async () => {
    const nome = nomeDe("A");
    const r = await cadastrar({
      nome,
      email: `a-${process.pid}@teste.local`,
      senha: "uma-senha-comprida",
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    criados.push(r.slug);

    // O vault nasce com estrutura e sem corpo: é esse estado que a interface
    // reconhece para levar à entrevista em vez de exibir um painel zerado.
    const blocos = await comAmbiente(
      r.slug,
      "select corpo from vault_bloco order by ordem",
    );
    expect(blocos.length).toBeGreaterThan(0);
    expect(blocos.every((b) => b.corpo === "")).toBe(true);

    // Sem config o pipeline não tem pesos nem janelas para decidir nada.
    const config = await comAmbiente(r.slug, "select * from config");
    expect(config).toHaveLength(1);
  });

  it("dá endereço próprio a duas empresas de mesmo nome", async () => {
    // Recusar a segunda por conta do nome seria estranho: nome de empresa se
    // repete, e quem chega depois não tem culpa.
    const nome = nomeDe("Repetido");
    const um = await cadastrar({
      nome,
      email: `r1-${process.pid}@teste.local`,
      senha: "uma-senha-comprida",
    });
    const dois = await cadastrar({
      nome,
      email: `r2-${process.pid}@teste.local`,
      senha: "uma-senha-comprida",
    });

    expect(um.ok && dois.ok).toBe(true);
    if (!um.ok || !dois.ok) return;
    criados.push(um.slug, dois.slug);
    expect(dois.slug).not.toBe(um.slug);
  });

  it("recusa e-mail que já tem conta", async () => {
    const email = `dup-${process.pid}@teste.local`;
    const um = await cadastrar({
      nome: nomeDe("Dup1"),
      email,
      senha: "uma-senha-comprida",
    });
    expect(um.ok).toBe(true);
    if (um.ok) criados.push(um.slug);

    const dois = await cadastrar({
      nome: nomeDe("Dup2"),
      email,
      senha: "uma-senha-comprida",
    });
    expect(dois.ok).toBe(false);
    if (!dois.ok) expect(dois.erro).toMatch(/já tem conta/);
  });

  it("recusa antes de criar qualquer coisa", async () => {
    // Uma recusa que já criou o ambiente deixa lixo que ninguém vai limpar —
    // e pior, deixa o slug ocupado por um cadastro que falhou.
    const nome = nomeDe("Curta");
    const r = await cadastrar({
      nome,
      email: `curta-${process.pid}@teste.local`,
      senha: "curta",
    });
    expect(r.ok).toBe(false);

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const { rows } = await pool.query(
      "select 1 from ambiente where nome = $1",
      [nome],
    );
    await pool.end();
    expect(rows).toHaveLength(0);
  });

  it("recusa nome sem letra nem número", async () => {
    const r = await cadastrar({
      nome: "!!!",
      email: `simbolo-${process.pid}@teste.local`,
      senha: "uma-senha-comprida",
    });
    expect(r.ok).toBe(false);
  });
});
