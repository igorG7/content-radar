import { describe, expect, it, afterAll } from "vitest";
import { readFile, readdir, access } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { Pool } from "pg";
import { ambienteSemeado } from "./teste-banco";
import { materializar, descartar, type Workspace } from "./workspace";
import { encerrarPool } from "./cliente";
import { RADAR_ROOT } from "../lib/manifest";

/**
 * Amarra a instrução das skills à forma do workspace.
 *
 * A skill diz o que ler; o workspace precisa ter. Sem este teste, editar a
 * skill para ler um arquivo novo compila, passa em tudo, e só falha quando um
 * scan de verdade rodar — 20 minutos depois, com dinheiro de API gasto.
 */

const disponivel = await ambienteSemeado("avanz-imoveis");

let ws: Workspace;
afterAll(async () => {
  if (ws) await descartar(ws);
  await encerrarPool();
});

async function existe(p: string): Promise<boolean> {
  return access(p)
    .then(() => true)
    .catch(() => false);
}

describe.skipIf(!disponivel)("contrato entre skill e workspace", () => {
  it("nenhuma skill ou agente lê dado por caminho absoluto", async () => {
    const raiz = path.join(RADAR_ROOT, ".claude");
    const arquivos = (
      await readdir(raiz, { recursive: true, withFileTypes: true })
    )
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => path.join(e.parentPath, e.name));

    // A regra é estreita de propósito: o proibido é caminho absoluto para
    // **dado deste projeto** — o manifest, o store e o vault do cliente. Uma
    // spec é documentação do produto, e o Open Design é sistema vizinho; nem
    // uma nem outro viajam por ambiente, então podem ser absolutos.
    const PROIBIDO =
      /`(\/srv\/apps\/content-radar\/(?!docs\/specs\/)[^`]+|\/srv\/my-mind\/[^`]+)`/g;

    const infracoes: string[] = [];
    for (const arquivo of arquivos) {
      for (const m of (await readFile(arquivo, "utf8")).matchAll(PROIBIDO)) {
        infracoes.push(
          `${path.basename(path.dirname(arquivo))}/${path.basename(arquivo)} → ${m[1]}`,
        );
      }
    }
    expect(infracoes).toEqual([]);
  });

  it("tudo que a skill manda carregar existe no workspace", async () => {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL_MIGRATIONS,
    });
    const { rows } = await pool.query(
      "select id from ambiente where slug='avanz-imoveis'",
    );
    await pool.end();
    ws = await materializar(rows[0].id);

    // Passo 1 da skill: ./manifest.yaml
    const manifest = parse(
      await readFile(path.join(ws.dir, "manifest.yaml"), "utf8"),
    );

    // Passo 2: todos os arquivos do always_load
    const ausentes: string[] = [];
    for (const rel of manifest.target_company.always_load) {
      if (!(await existe(path.join(ws.dir, rel)))) ausentes.push(rel);
    }

    // Passo 3: os quatro diretórios de brief
    for (const estado of [
      "pendente-aprovacao",
      "pendente-publicacao",
      "publicado",
      "rejeitado",
    ]) {
      if (!(await existe(path.join(ws.dir, "store", "briefs", estado)))) {
        ausentes.push(`store/briefs/${estado}`);
      }
    }

    // Passo 4: os arquivos por pilar
    for (const arquivos of Object.values(
      manifest.target_company.per_pillar ?? {},
    )) {
      for (const rel of arquivos as string[]) {
        if (!(await existe(path.join(ws.dir, rel)))) ausentes.push(rel);
      }
    }

    expect(ausentes).toEqual([]);
  });

  it("as specs que as skills citam chegam junto", async () => {
    /**
     * As skills e subagentes citam "§4 da spec 002", "§4.2 da spec 004" o
     * tempo todo. Antes do workspace isso resolvia lendo o repositório; quando
     * o isolamento entrou, o documento saiu do alcance e o pipeline passou a
     * errar calado — o briefer inventou os nomes dos campos do brief porque o
     * schema deixou de existir para ele.
     */
    const citadas = new Set<string>();
    const raiz = path.join(ws.dir, ".claude");
    for (const e of await readdir(raiz, {
      recursive: true,
      withFileTypes: true,
    })) {
      if (!e.isFile() || !e.name.endsWith(".md")) continue;
      const texto = await readFile(
        path.join(e.parentPath ?? raiz, e.name),
        "utf8",
      );
      for (const m of texto.matchAll(/spec (\d{3})/g)) citadas.add(m[1]);
    }
    expect(citadas.size).toBeGreaterThan(0);

    const specs = await readdir(path.join(ws.dir, "docs", "specs")).catch(
      () => [] as string[],
    );
    const ausentes = [...citadas].filter(
      (n) => !specs.some((f) => f.startsWith(n)),
    );
    expect(ausentes).toEqual([]);
  });

  it("as skills e os subagentes chegam junto", async () => {
    // O Agent SDK carrega a partir do diretório de trabalho; sem isto o
    // executor rodaria sem saber invocar estágio nenhum.
    expect(
      await existe(path.join(ws.dir, ".claude", "skills", "radar-scan")),
    ).toBe(true);
    expect(
      await existe(path.join(ws.dir, ".claude", "agents", "avanz-matcher.md")),
    ).toBe(true);
    // Contra o repositório, não contra um número: as três skills
    // determinísticas viraram código e sumiram daqui, e um limite fixo teria
    // falhado por estar desatualizado em vez de por faltar alguma coisa.
    const noRepo = (await readdir(path.join(RADAR_ROOT, ".claude", "skills")))
      .length;
    expect(ws.skills).toBe(noRepo);
  });

  it("o que o manifest promete sobre score é o que o vault entrega", async () => {
    const manifest = parse(
      await readFile(path.join(ws.dir, "manifest.yaml"), "utf8"),
    );
    const pilares = await readFile(
      path.join(ws.dir, "vault/pilares.md"),
      "utf8",
    );
    const publicos = await readFile(
      path.join(ws.dir, "vault/publicos.md"),
      "utf8",
    );

    // O score pontua pilar e público; os códigos precisam estar legíveis para o
    // agente citar sem inventar.
    expect(
      manifest.anti_repetition.match_score_weights.pillar_fit,
    ).toBeGreaterThan(0);
    expect(pilares).toMatch(/## Códigos em uso/);
    expect(publicos).toMatch(/## Códigos em uso/);
  });
});
