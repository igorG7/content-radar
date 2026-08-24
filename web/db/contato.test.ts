import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { bancoDisponivel } from "./teste-banco";
import { backendPostgres } from "./backend";
import { encerrarPool } from "./cliente";

/**
 * Os fatos da marca — telefone, canal e o @ do Instagram.
 *
 * O @ vinha do `localStorage`: cada navegador via um valor, e quem nunca
 * configurou via `suamarca` na prévia do feed de um cliente real. Num produto
 * de um usuário só isso passava; com dois clientes, é dado do cliente.
 */

const disponivel = await bancoDisponivel();
const SLUG = `teste-contato-${process.pid}`;
let ambienteId = "";
let outroId = "";

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
  for (const s of [SLUG, `${SLUG}-outro`]) {
    await dono("delete from ambiente where slug = $1", [s]);
  }
  [{ id: ambienteId }] = await dono(
    "insert into ambiente (slug, nome, prefixo_midia) values ($1,$1,$1) returning id",
    [SLUG],
  );
  [{ id: outroId }] = await dono(
    "insert into ambiente (slug, nome, prefixo_midia) values ($1,$1,$1) returning id",
    [`${SLUG}-outro`],
  );
});

afterAll(async () => {
  if (disponivel) {
    for (const s of [SLUG, `${SLUG}-outro`]) {
      await dono("delete from ambiente where slug = $1", [s]);
    }
  }
  await encerrarPool();
});

const base = {
  canalPrincipal: "WhatsApp",
  telefoneExibicao: "(31) 9 9077-4580",
  telefoneE164: "+5531990774580",
  telefoneSecundarioE164: null,
};

describe.skipIf(!disponivel)("contato da marca", () => {
  it("guarda e devolve o @ do Instagram", async () => {
    const store = backendPostgres(ambienteId);
    await store.gravarContato({ ...base, instagram: "avanzimoveis" });
    expect((await store.contato())?.instagram).toBe("avanzimoveis");
  });

  it("cada cliente tem o seu", async () => {
    // O ponto da migração: no navegador, o valor era da máquina e vazava de um
    // cliente para o outro em quem usasse os dois.
    await backendPostgres(ambienteId).gravarContato({
      ...base,
      instagram: "primeira",
    });
    await backendPostgres(outroId).gravarContato({
      ...base,
      instagram: "segunda",
    });

    expect((await backendPostgres(ambienteId).contato())?.instagram).toBe(
      "primeira",
    );
    expect((await backendPostgres(outroId).contato())?.instagram).toBe(
      "segunda",
    );
  });

  it("aceita ausência — nem todo cliente tem Instagram", async () => {
    const store = backendPostgres(ambienteId);
    await store.gravarContato({ ...base, instagram: null });
    expect((await store.contato())?.instagram).toBeNull();
  });

  it("não apaga o telefone ao gravar o @", async () => {
    // Os dois vivem na mesma linha; uma gravação parcial os zeraria.
    const store = backendPostgres(ambienteId);
    await store.gravarContato({ ...base, instagram: "avanzimoveis" });
    const c = await store.contato();
    expect(c?.telefoneE164).toBe("+5531990774580");
    expect(c?.canalPrincipal).toBe("WhatsApp");
  });
});
