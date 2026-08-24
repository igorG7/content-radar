import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { bancoDisponivel } from "./teste-banco";
import { encerrarPool } from "./cliente";
import {
  gravarNomeDeExibicao,
  nomeDeExibicao,
  type Sessao,
} from "../lib/sessao";

/**
 * O nome de exibição pertence à conta, não ao navegador.
 *
 * Ficava no `localStorage`: quem digitasse o nome numa máquina e abrisse o app
 * noutra via o derivado do e-mail de novo, sem entender por quê. E dois
 * editores do mesmo cliente compartilhariam ou não o nome conforme o navegador,
 * que é a pior das duas respostas.
 */

const disponivel = await bancoDisponivel();
const SLUG = `teste-nome-${process.pid}`;
let sessao: Sessao;

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
  await dono("delete from ambiente where slug = $1", [SLUG]);
  const [amb] = await dono(
    "insert into ambiente (slug, nome, prefixo_midia) values ($1,$1,$1) returning id",
    [SLUG],
  );
  const [usuario] = await dono(
    "insert into usuario (email, senha_hash, ambiente_id) values ($1,'x',$2) returning id",
    [`${SLUG}@teste.local`, amb.id],
  );
  sessao = {
    usuarioId: usuario.id,
    email: `${SLUG}@teste.local`,
    ambienteId: amb.id,
    ambienteSlug: SLUG,
    ambienteNome: SLUG,
    expiraEm: Date.now() + 86400000,
  };
});

afterAll(async () => {
  if (disponivel) await dono("delete from ambiente where slug = $1", [SLUG]);
  await encerrarPool();
});

describe.skipIf(!disponivel)("nome de exibição", () => {
  it("sem nome escolhido, deriva do e-mail", async () => {
    // É o que a tela já fazia; o que muda é de onde vem a escolha quando existe.
    expect(await nomeDeExibicao(sessao)).toBe(SLUG);
  });

  it("guarda o nome escolhido", async () => {
    await gravarNomeDeExibicao(sessao.usuarioId, "Igor");
    expect(await nomeDeExibicao(sessao)).toBe("Igor");
  });

  it("limpar volta ao derivado, em vez de deixar em branco", async () => {
    // Apagar o campo é intenção válida: quer dizer "use o padrão", não "some
    // com o meu nome da barra".
    await gravarNomeDeExibicao(sessao.usuarioId, "Igor");
    await gravarNomeDeExibicao(sessao.usuarioId, null);
    expect(await nomeDeExibicao(sessao)).toBe(SLUG);
  });

  it("só espaço conta como vazio", async () => {
    await gravarNomeDeExibicao(sessao.usuarioId, "   ");
    expect(await nomeDeExibicao(sessao)).toBe(SLUG);
  });
});
