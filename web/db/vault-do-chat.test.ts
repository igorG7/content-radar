import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { bancoDisponivel } from "./teste-banco";
import { backendPostgres } from "./backend";
import { encerrarPool } from "./cliente";
import { porNome } from "../lib/chat/ferramentas";

/**
 * O chat passou a ler o vault do cliente.
 *
 * Antes ele o alcançava por acidente e pelo caminho errado: com as ferramentas
 * built-in disponíveis, lia `docs/vault-avanz.md` do disco. Funcionava, e num
 * produto multi-empresa entregava **sempre o vault da Avanz**, qualquer que
 * fosse o cliente da conversa.
 *
 * O que se exige aqui é o oposto disso: que cada conversa veja o vault do seu
 * ambiente e não exista caminho para o do vizinho. Quem garante é o RLS, e este
 * teste existe para provar que a ferramenta passa por ele.
 */

const disponivel = await bancoDisponivel();

const A = "teste-vault-a";
const B = "teste-vault-b";
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
  for (const [slug, corpo] of [
    [A, "A Imobiliária A atua em Contagem, e o segredo dela é o número 111."],
    [B, "A Imobiliária B atua em Betim, e o segredo dela é o número 222."],
  ]) {
    await dono("delete from ambiente where slug = $1", [slug]);
    const rows = await dono(
      "insert into ambiente (slug, nome, prefixo_midia) values ($1,$1,$1) returning id",
      [slug],
    );
    ids[slug] = rows[0].id;
    /**
     * Com `app.ambiente` na mesma transação — o FORCE RLS vale também para o
     * dono, então nem a preparação do teste escreve num ambiente sem dizer
     * qual. É a mesma porta que a aplicação usa.
     */
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL_MIGRATIONS,
    });
    const cliente = await pool.connect();
    try {
      await cliente.query("begin");
      await cliente.query("select set_config('app.ambiente', $1, true)", [
        ids[slug],
      ]);
      await cliente.query(
        `insert into vault_bloco (ambiente_id, slug, titulo, corpo, ordem, escopo, contrato, versao)
         values ($1, 'identidade', 'Identidade e origem', $2, 1, 'sempre', 'degrada', 1)`,
        [ids[slug], corpo],
      );
      await cliente.query("commit");
    } finally {
      cliente.release();
      await pool.end();
    }
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

const vault = porNome("vault_da_marca")!;

describe.skipIf(!disponivel)("o vault no chat", () => {
  it("existe como ferramenta", () => {
    // Se sumir da lista, o chat volta a depender de o conteúdo estar duplicado
    // na prosa dos pilares — que foi o estado anterior, e ninguém percebeu.
    expect(vault).toBeDefined();
  });

  it("cada ambiente lê o seu, e só o seu", async () => {
    const deA = (await vault.executar(backendPostgres(ids[A]), {
      bloco: "identidade",
    })) as { corpo: string };
    const deB = (await vault.executar(backendPostgres(ids[B]), {
      bloco: "identidade",
    })) as { corpo: string };

    expect(deA.corpo).toContain("111");
    expect(deA.corpo).not.toContain("222");
    expect(deB.corpo).toContain("222");
    expect(deB.corpo).not.toContain("111");
  });

  it("a listagem não vaza o corpo do vizinho", async () => {
    const lista = (await vault.executar(backendPostgres(ids[A]), {})) as {
      blocos: { slug: string; inicio: string }[];
    };
    const tudo = JSON.stringify(lista);
    expect(tudo).toContain("111");
    expect(tudo).not.toContain("222");
  });

  it("a listagem resume, para não despejar o vault inteiro no contexto", async () => {
    const lista = (await vault.executar(backendPostgres(ids[A]), {})) as {
      blocos: { inicio: string; preenchido: boolean }[];
    };
    expect(lista.blocos[0].preenchido).toBe(true);
    expect(lista.blocos[0].inicio.length).toBeLessThanOrEqual(240);
  });

  it("bloco inexistente diz quais existem, em vez de devolver vazio", async () => {
    // Sem a lista, o agente tenta adivinhar o slug e erra de novo.
    const r = (await vault.executar(backendPostgres(ids[A]), {
      bloco: "nao-existe",
    })) as { erro: string; disponiveis: string[] };
    expect(r.erro).toContain("nao-existe");
    expect(r.disponiveis).toContain("identidade");
  });
});
