import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { backendPostgres } from "./backend";
import { encerrarPool } from "./cliente";
import { assinar, type Enviador } from "../lib/midia/cloudinary";
import { loadManifest, resolvePaths } from "../lib/manifest";

/**
 * A foto escolhida sobe na hora da escolha — é o instante em que ela deixa de
 * ser cache local e vira artefato externo.
 *
 * Nenhum teste aqui toca na rede: o enviador é parâmetro, e o que se verifica é
 * o que a camada faz com o resultado dele.
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

const SLUG = "teste-nuvem";
let ambienteId = "";
let briefId = "";
let arquivo = "";

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

/** Registra o que recebeu, para o teste poder afirmar sobre a chamada. */
function enviadorFalso() {
  const chamadas: { publicId: string }[] = [];
  const enviar: Enviador = async ({ publicId }) => {
    chamadas.push({ publicId });
    return {
      url: `https://res.cloudinary.com/x/v${chamadas.length}/${publicId}.jpg`,
      publicId,
    };
  };
  return Object.assign(enviar, { chamadas });
}

describe("assinatura", () => {
  it("ordena os parâmetros por chave antes de assinar", () => {
    // Fora de ordem o Cloudinary recusa, e a mensagem fala de assinatura
    // inválida — não de ordem. Congelar o valor é o que denuncia a regressão.
    const a = assinar({ timestamp: "1", public_id: "x/y" }, "segredo");
    const b = assinar({ public_id: "x/y", timestamp: "1" }, "segredo");
    expect(a).toBe(b);
    // Conferido fora do código que está sendo testado:
    //   printf '%s' 'public_id=x/y&timestamp=1segredo' | sha1sum
    // Copiar a saída da própria função tornaria a asserção circular.
    expect(a).toBe("5f8f89e788e7289bdbcd7242da7fc398e69f38e7");
  });

  it("o segredo muda a assinatura", () => {
    expect(assinar({ a: "1" }, "um")).not.toBe(assinar({ a: "1" }, "dois"));
  });
});

describe.skipIf(!disponivel)("escolha da arte sobe para a nuvem", () => {
  beforeAll(async () => {
    await dono("delete from ambiente where slug = $1", [SLUG]);
    const rows = await dono(
      "insert into ambiente (slug, nome, prefixo_midia) values ($1,$1,$2) returning id",
      [SLUG, `midia/${SLUG}`],
    );
    ambienteId = rows[0].id;

    await noAmbiente(
      `insert into pilar (ambiente_id, slug, nome, corpo, ordem) values ($1,'decisao','Decisão','x',1)`,
      [ambienteId],
    );
    await noAmbiente(
      `insert into publico (ambiente_id, slug, nome, corpo) values ($1,'investidor','Investidor','x')`,
      [ambienteId],
    );
    const b = await noAmbiente(
      `insert into brief (ambiente_id, slug, brief_id, estado, pilar_slug, publico_slug, headline, topic_hash)
       values ($1,'brief-nuvem','W34-950','pendente-aprovacao','decisao','investidor','Headline','hash-nuvem')
       returning id`,
      [ambienteId],
    );
    briefId = b[0].id;

    // Duas candidatas com arquivo de verdade no cache local, porque o upload lê
    // bytes do disco.
    const dir = resolvePaths(await loadManifest()).mediaDir[
      "pendente-aprovacao"
    ];
    await mkdir(dir, { recursive: true });
    for (const i of [0, 1]) {
      const nome = `teste-nuvem-${i}.jpg`;
      await writeFile(path.join(dir, nome), Buffer.from([0xff, 0xd8, i]));
      await noAmbiente(
        `insert into brief_candidata (ambiente_id, brief_id, indice, objeto_path)
         values ($1,$2,$3,$4)`,
        [ambienteId, briefId, i, nome],
      );
    }
    arquivo = dir;
  });

  afterAll(async () => {
    if (disponivel) {
      for (const i of [0, 1]) {
        await rm(path.join(arquivo, `teste-nuvem-${i}.jpg`), { force: true });
      }
      await dono("delete from ambiente where slug = $1", [SLUG]);
    }
    await encerrarPool();
  });

  it("sobe a escolhida e guarda URL, public_id e evento", async () => {
    const enviar = enviadorFalso();
    await backendPostgres(ambienteId, {
      enviarParaNuvem: enviar,
    }).gravarEscolhaHero("brief-nuvem", 1);

    // Prefixo do ambiente no caminho: é o que impede a mídia de dois clientes
    // de colidir, como acontece hoje no cache local.
    expect(enviar.chamadas).toEqual([
      { publicId: `midia/${SLUG}/brief-nuvem` },
    ]);

    const [c] = await noAmbiente(
      `select cloud_url, cloudinary_public_id from brief_candidata
       where brief_id = $1 and indice = 1`,
      [briefId],
    );
    expect(c.cloud_url).toContain("res.cloudinary.com");
    expect(c.cloudinary_public_id).toBe(`midia/${SLUG}/brief-nuvem`);

    const [e] = await noAmbiente(
      `select tipo, extra from evento where brief_id = $1 and tipo = 'cloudinary-uploaded'`,
      [briefId],
    );
    expect(e.extra.indice).toBe(1);
  });

  it("reescolher sobrescreve o mesmo objeto, sem deixar órfão", async () => {
    const enviar = enviadorFalso();
    const store = backendPostgres(ambienteId, { enviarParaNuvem: enviar });
    await store.gravarEscolhaHero("brief-nuvem", 0);
    await store.gravarEscolhaHero("brief-nuvem", 1);

    // O public_id é do brief, não da candidata: três cliques antes de decidir
    // não podem virar três arquivos pagos na conta.
    expect(new Set(enviar.chamadas.map((c) => c.publicId)).size).toBe(1);
  });

  it("sem foto não sobe nada", async () => {
    const enviar = enviadorFalso();
    await backendPostgres(ambienteId, {
      enviarParaNuvem: enviar,
    }).gravarEscolhaHero("brief-nuvem", null);
    expect(enviar.chamadas).toEqual([]);
  });

  it("falha de upload não desfaz a escolha da pessoa", async () => {
    // A decisão é humana e já é válida; o que fica pendente é a cópia remota.
    // Derrubar a transação faria o Cloudinary fora do ar travar a revisão.
    const quebrado: Enviador = async () => {
      throw new Error("502 do Cloudinary");
    };
    await backendPostgres(ambienteId, {
      enviarParaNuvem: quebrado,
    }).gravarEscolhaHero("brief-nuvem", 0);

    const [b] = await noAmbiente(
      `select hero_indice, hero_decidido_em from brief where id = $1`,
      [briefId],
    );
    expect(b.hero_indice).toBe(0);
    expect(b.hero_decidido_em).not.toBeNull();

    const [e] = await noAmbiente(
      `select extra from evento where brief_id = $1 and tipo = 'cloudinary-falhou'`,
      [briefId],
    );
    expect(String(e.extra.erro)).toContain("502");
  });

  it("descartar a candidata apaga o arquivo e o objeto remoto", async () => {
    // O comentário do código dizia que os arquivos sumiam com o registro. Não
    // sumiam: a linha saía do banco e o `.jpg` ficava no disco para sempre — e
    // o objeto no Cloudinary, cobrado, sem nada apontando para ele.
    //
    // Brief próprio: aprovar muda estado, e os outros testes contam com o
    // compartilhado ainda em pendente-aprovacao.
    const apagados: string[] = [];
    const store = backendPostgres(ambienteId, {
      enviarParaNuvem: enviadorFalso(),
      apagarDaNuvem: async (id) => void apagados.push(id),
    });

    const [b] = await noAmbiente(
      `insert into brief (ambiente_id, slug, brief_id, estado, pilar_slug, publico_slug, headline, topic_hash)
       values ($1,'brief-descarte','W34-951','pendente-aprovacao','decisao','investidor','H','hash-descarte')
       returning id`,
      [ambienteId],
    );
    const caminho = await store.caminhoMidia(
      "pendente-aprovacao",
      "descarte-0.jpg",
    );
    await mkdir(path.dirname(caminho), { recursive: true });
    await writeFile(caminho, Buffer.from([0xff, 0xd8, 0x00]));
    await noAmbiente(
      `insert into brief_candidata (ambiente_id, brief_id, indice, objeto_path)
       values ($1,$2,0,'descarte-0.jpg')`,
      [ambienteId, b.id],
    );

    await store.gravarEscolhaHero("brief-descarte", 0);
    // Aprovar sem foto descarta todas as candidatas.
    await store.gravarEscolhaHero("brief-descarte", null);
    await store.aplicarTransicao({
      slug: "brief-descarte",
      direcao: "approve",
    });

    expect(existsSync(caminho)).toBe(false);
    expect(apagados).toEqual([`midia/${SLUG}/brief-descarte`]);
  });

  it("sem credencial configurada, escolher continua funcionando", async () => {
    await backendPostgres(ambienteId, {
      enviarParaNuvem: null,
    }).gravarEscolhaHero("brief-nuvem", 1);

    const [b] = await noAmbiente(
      `select hero_indice from brief where id = $1`,
      [briefId],
    );
    expect(b.hero_indice).toBe(1);
  });
});
