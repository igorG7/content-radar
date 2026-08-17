import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A camada de armazenamento só vale enquanto for o único caminho até os dados.
 * Sem este teste, a primeira tela nova refaz o padrão antigo — monta caminho
 * com path.join, passa `paths` adiante — e a costura se desfaz em silêncio.
 *
 * Ver docs/design-migracao.md §3.
 */

const RAIZ = path.resolve(import.meta.dirname, "../..");

/** Territórios do app. `lib/` fica de fora: é onde a implementação vive. */
const TERRITORIOS = ["app", "components", "scripts"];

/** Símbolos que revelam conhecimento de onde os dados moram.
 *  `RADAR_ROOT` fica de fora: os scripts precisam defini-lo antes de importar
 *  qualquer módulo, porque a raiz vem da localização do próprio arquivo e não
 *  do cwd. É bootstrap, não acesso a dado. */
const PROIBIDOS = ["resolvePaths", "briefsDir", "mediaDir", "RadarPaths", "MANIFEST_PATH"];

async function arquivosDe(dir: string): Promise<string[]> {
  const entradas = await readdir(dir, { withFileTypes: true, recursive: true });
  return entradas
    .filter((e) => e.isFile() && /\.(ts|tsx|mts)$/.test(e.name))
    .map((e) => path.join(e.parentPath, e.name));
}

describe("fronteira da camada de armazenamento", () => {
  it("nada fora de lib/ conhece caminho de brief ou de mídia", async () => {
    const infracoes: string[] = [];

    for (const territorio of TERRITORIOS) {
      for (const arquivo of await arquivosDe(path.join(RAIZ, territorio))) {
        const fonte = await readFile(arquivo, "utf8");
        for (const simbolo of PROIBIDOS) {
          if (new RegExp(`\\b${simbolo}\\b`).test(fonte)) {
            infracoes.push(`${path.relative(RAIZ, arquivo)} → ${simbolo}`);
          }
        }
      }
    }

    expect(infracoes).toEqual([]);
  });

  it("o store de arquivo não vaza para fora de lib/store e lib/transitions", async () => {
    const infracoes: string[] = [];

    for (const territorio of TERRITORIOS) {
      for (const arquivo of await arquivosDe(path.join(RAIZ, territorio))) {
        const fonte = await readFile(arquivo, "utf8");
        // Importar os módulos internos direto pula a camada — e com isso pula
        // o ambiente, que é o que vai sustentar o isolamento entre clientes.
        // `frontmatter` fica de fora: parseFrontmatter e patchScalars são
        // manipulação de texto, não localização de dado.
        if (/from ["']@?\/?(\.\.\/)*lib\/(store\/(briefs|ledger)|transitions\/mv)["']/.test(fonte)) {
          infracoes.push(path.relative(RAIZ, arquivo));
        }
      }
    }

    expect(infracoes).toEqual([]);
  });
});
