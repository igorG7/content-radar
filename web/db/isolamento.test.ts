import { sql } from "drizzle-orm";
import { Pool } from "pg";
import { bancoDisponivel } from "./teste-banco";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { comAmbiente, db, encerrarPool } from "./cliente";
import { ambiente, brief, evento, pilar, publico } from "./schema";

/**
 * O isolamento entre clientes é a única fronteira do modelo — se ele falhar,
 * um ambiente vê conteúdo de outro. Configurar RLS não prova nada; estes testes
 * provam, com dado de duas empresas na mesma tabela.
 *
 * Precisam do Postgres de desenvolvimento. Sem ele, pulam em vez de falhar.
 */

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";

/**
 * Verificado no carregamento, não no beforeAll: com a checagem lá dentro, um
 * banco indisponível faria cada teste sair pela porta dos fundos e o conjunto
 * passaria sem exercitar nada. Aqui ele é pulado à vista.
 */
const disponivel = await bancoDisponivel();

/**
 * O Drizzle embrulha o erro do Postgres numa mensagem própria ("Failed query:
 * ..."), e a razão da recusa fica em `cause`. Asserção sobre a mensagem de
 * fora passaria com qualquer falha — inclusive erro de sintaxe.
 */
async function motivoDaRecusa(
  trabalho: () => Promise<unknown>,
): Promise<string> {
  try {
    await trabalho();
  } catch (erro) {
    const causa = (erro as { cause?: unknown }).cause ?? erro;
    return String((causa as Error).message ?? causa);
  }
  throw new Error("esperava recusa, e a operação passou");
}

/** Semeia como radar_owner — que também é barrado pelo FORCE, então declara o
 *  ambiente igual. É o mesmo caminho que o importador vai percorrer. */
async function semear() {
  const dono = new Pool({
    connectionString: process.env.DATABASE_URL_MIGRATIONS,
  });
  try {
    for (const [id, slug] of [
      [A, "empresa-a"],
      [B, "empresa-b"],
    ]) {
      await dono.query(
        `insert into ambiente (id, slug, nome, prefixo_midia) values ($1,$2,$3,$4)
         on conflict (id) do nothing`,
        [id, slug, slug, `midia/${slug}`],
      );
      await dono.query("begin");
      await dono.query("select set_config('app.ambiente', $1, true)", [id]);
      await dono.query(
        `insert into pilar (ambiente_id, slug, nome, corpo, ordem)
         values ($1,'decisao','Decisão','corpo',1) on conflict do nothing`,
        [id],
      );
      await dono.query(
        `insert into publico (ambiente_id, slug, nome, corpo)
         values ($1,'comprador','Comprador','corpo') on conflict do nothing`,
        [id],
      );
      await dono.query(
        `insert into brief (ambiente_id, brief_id, slug, estado, pilar_slug, publico_slug,
                            topic_hash, headline)
         values ($1,$2,$3,'pendente-aprovacao','decisao','comprador',$4,$5)
         on conflict do nothing`,
        [
          id,
          `2026-W99-${slug}`,
          `slug-${slug}`,
          `hash-${slug}`,
          `headline de ${slug}`,
        ],
      );
      await dono.query(
        `insert into evento (ambiente_id, tipo, ator) values ($1,'brief-created','teste')`,
        [id],
      );
      await dono.query("commit");
    }
  } finally {
    await dono.end();
  }
}

async function limpar() {
  const dono = new Pool({
    connectionString: process.env.DATABASE_URL_MIGRATIONS,
  });
  try {
    await dono.query("delete from ambiente where id = any($1)", [[A, B]]);
  } finally {
    await dono.end();
  }
}

describe.skipIf(!disponivel)("isolamento entre ambientes", () => {
  beforeAll(semear);
  afterAll(async () => {
    await limpar();
    await encerrarPool();
  });

  it("sem ambiente declarado, não devolve linha nenhuma", async () => {
    const linhas = await db().select().from(brief);
    expect(linhas).toHaveLength(0);
  });

  it("cada ambiente enxerga só o próprio brief", async () => {
    const daA = await comAmbiente(A, (tx) => tx.select().from(brief));
    const daB = await comAmbiente(B, (tx) => tx.select().from(brief));

    expect(daA.map((b) => b.headline)).toEqual(["headline de empresa-a"]);
    expect(daB.map((b) => b.headline)).toEqual(["headline de empresa-b"]);
  });

  it("gravar linha no ambiente alheio é recusado pelo banco", async () => {
    // Dentro do ambiente A, tentando inserir uma linha marcada como do B.
    const motivo = await motivoDaRecusa(() =>
      comAmbiente(A, (tx) =>
        tx
          .insert(evento)
          .values({ ambienteId: B, tipo: "invasao", ator: "teste" }),
      ),
    );
    expect(motivo).toMatch(/row-level security/i);
  });

  it("brief não pode apontar para pilar de outro ambiente", async () => {
    // O pilar 'decisao' existe nos dois ambientes; a chave estrangeira é
    // composta com ambiente_id, então a referência não atravessa a fronteira.
    // Aqui o alvo é um pilar que só existe em B.
    const dono = new Pool({
      connectionString: process.env.DATABASE_URL_MIGRATIONS,
    });
    try {
      await dono.query("begin");
      await dono.query("select set_config('app.ambiente', $1, true)", [B]);
      await dono.query(
        `insert into pilar (ambiente_id, slug, nome, corpo, ordem)
         values ($1,'so-do-b','Só do B','corpo',2)`,
        [B],
      );
      await dono.query("commit");

      await dono.query("begin");
      await dono.query("select set_config('app.ambiente', $1, true)", [A]);
      const motivo = await motivoDaRecusa(() =>
        dono.query(
          `insert into brief (ambiente_id, brief_id, slug, estado, pilar_slug, publico_slug,
                              topic_hash, headline)
           values ($1,'2026-W99-x','slug-x','pendente-aprovacao','so-do-b','comprador','h','h')`,
          [A],
        ),
      );
      expect(motivo).toMatch(/foreign key|violates/i);
      await dono.query("rollback");
    } finally {
      await dono.end();
    }
  });

  it("o ledger não aceita reescrita pela aplicação", async () => {
    const aoAtualizar = await motivoDaRecusa(() =>
      comAmbiente(A, (tx) =>
        tx.execute(sql`update evento set tipo = 'adulterado'`),
      ),
    );
    expect(aoAtualizar).toMatch(/permission denied/i);

    const aoApagar = await motivoDaRecusa(() =>
      comAmbiente(A, (tx) => tx.execute(sql`delete from evento`)),
    );
    expect(aoApagar).toMatch(/permission denied/i);
  });

  it("apagar um brief preserva o evento que registra que ele existiu", async () => {
    const dono = new Pool({
      connectionString: process.env.DATABASE_URL_MIGRATIONS,
    });
    try {
      await dono.query("begin");
      await dono.query("select set_config('app.ambiente', $1, true)", [A]);
      // Um brief próprio, para não consumir o do cenário: teste que depende da
      // ordem de outro quebra quando alguém reordena.
      const { rows } = await dono.query(
        `insert into brief (ambiente_id, brief_id, slug, estado, pilar_slug,
                            publico_slug, topic_hash, headline)
         values ($1,'2026-W97-001','descartavel','pendente-aprovacao','decisao',
                 'comprador','hash-descartavel','Descartável')
         returning id`,
        [A],
      );
      await dono.query(
        "insert into evento (ambiente_id, tipo, ator, brief_id) values ($1,'teste','teste',$2)",
        [A, rows[0].id],
      );

      // Numa chave estrangeira composta, SET NULL sem lista anularia também o
      // ambiente_id — que é NOT NULL — e a exclusão falharia (migração 0003).
      await dono.query("delete from brief where id = $1", [rows[0].id]);

      const depois = await dono.query(
        "select ambiente_id, brief_id from evento where tipo = 'teste'",
      );
      await dono.query("commit");

      expect(depois.rows[0].brief_id).toBe(null);
      expect(depois.rows[0].ambiente_id).toBe(A);
    } finally {
      await dono.end();
    }
  });

  it("apagar o ambiente leva o conteúdo junto", async () => {
    const dono = new Pool({
      connectionString: process.env.DATABASE_URL_MIGRATIONS,
    });
    try {
      await dono.query("delete from ambiente where id = $1", [B]);
      await dono.query("begin");
      await dono.query("select set_config('app.ambiente', $1, true)", [B]);
      const { rows } = await dono.query("select count(*)::int as n from brief");
      await dono.query("commit");
      expect(rows[0].n).toBe(0);

      // e o ambiente A segue intacto
      const daA = await comAmbiente(A, (tx) => tx.select().from(brief));
      expect(daA).toHaveLength(1);
    } finally {
      await dono.end();
    }
  });
});

// `ambiente` e `publico` são importados para o esquema ser exercitado por
// inteiro na tipagem; o uso direto está nas consultas cruas acima.
void ambiente;
void publico;
void pilar;
