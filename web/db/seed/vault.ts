/**
 * Lê `docs/vault-avanz.md` e devolve os blocos prontos para o banco.
 *
 * O documento é a fonte porque foi revisado a olho: é o vault da Avanz na forma
 * decidida, com o conteúdo real. Manter um segundo artefato (JSON, TS) ao lado
 * criaria duas verdades que divergem na primeira edição.
 *
 * O parser é estrito de propósito. Seção sem marcador válido, slug repetido ou
 * bloco esperado que não aparece são erro — não aviso, não valor padrão. Um
 * semeador que "dá um jeito" no que não entendeu é como conteúdo errado entra
 * no banco sem ninguém ver.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { RADAR_ROOT } from "../../lib/manifest";

export const DOC_VAULT = path.join(RADAR_ROOT, "docs", "vault-avanz.md");

export type Escopo = "sempre" | "por-pilar";
export type Contrato = "obrigatorio" | "degrada" | "opcional";

export interface BlocoLido {
  slug: string;
  titulo: string;
  escopo: Escopo;
  contrato: Contrato;
  corpo: string;
  ordem: number;
}

/**
 * Os blocos de prosa do vault. `fontes` e `ajustes` são configuração; `contato`
 * é campo, na tabela `marca`. Nenhum dos três entra aqui.
 */
const ESPERADOS = [
  "identidade",
  "voz",
  "foco",
  "geografia",
  "publicos",
  "pilares",
  "guardrails",
  "cadencia",
  "visual",
  "temas",
] as const;

const MARCADOR =
  /^`bloco: ([a-z-]+)` · escopo: (sempre|por-pilar) · contrato: (obrigatorio|degrada|opcional)$/;

export function lerBlocos(markdown: string): BlocoLido[] {
  const secoes = markdown.split(/^## /m).slice(1);
  const blocos: BlocoLido[] = [];
  const vistos = new Set<string>();

  for (const secao of secoes) {
    const linhas = secao.split("\n");
    const titulo = linhas[0].trim();
    const casa = MARCADOR.exec(linhas[1]?.trim() ?? "");

    // Seção sem marcador é prosa do documento (a nota final, por exemplo), não
    // bloco. Só vira erro se o marcador existir e estiver malformado.
    if (!casa) {
      if (linhas[1]?.trim().startsWith("`bloco:")) {
        throw new Error(
          `marcador malformado em "${titulo}": ${linhas[1].trim()}`,
        );
      }
      continue;
    }

    const [, slug, escopo, contrato] = casa;
    if (vistos.has(slug)) throw new Error(`bloco repetido: ${slug}`);
    vistos.add(slug);

    const corpo = linhas
      .slice(2)
      .join("\n")
      .replace(/\n---\s*$/, "")
      .trim();
    if (!corpo) throw new Error(`bloco sem corpo: ${slug}`);

    blocos.push({
      slug,
      titulo,
      escopo: escopo as Escopo,
      contrato: contrato as Contrato,
      corpo,
      ordem: blocos.length + 1,
    });
  }

  const faltando = ESPERADOS.filter((slug) => !vistos.has(slug));
  if (faltando.length > 0) {
    throw new Error(`blocos esperados e ausentes: ${faltando.join(", ")}`);
  }
  const sobrando = [...vistos].filter(
    (slug) => !ESPERADOS.includes(slug as never),
  );
  if (sobrando.length > 0) {
    throw new Error(`blocos não previstos no esquema: ${sobrando.join(", ")}`);
  }

  return blocos;
}

/* ── extração dos blocos com identidade ───────────────────────────────────
 * Pilares, públicos, guardrails e temas viram linha em tabela, porque algo de
 * fora aponta para eles. O corpo em prosa continua junto — é onde mora a
 * ressalva que faz o bloco funcionar.
 */

export interface ItemComId {
  slug: string;
  nome: string;
  corpo: string;
  ordem: number;
}

/** `### \`slug\`` seguido do parágrafo — formato de publicos e pilares. */
export function extrairSubBlocos(corpo: string): ItemComId[] {
  const partes = corpo.split(/^### /m).slice(1);
  return partes.map((parte, i) => {
    const linhas = parte.split("\n");
    const cabecalho = linhas[0].trim();
    const casa = /^`([a-z-]+)`$/.exec(cabecalho);
    if (!casa)
      throw new Error(`sub-bloco sem código entre crases: "${cabecalho}"`);
    return {
      slug: casa[1],
      nome: casa[1],
      corpo: linhas.slice(1).join("\n").trim(),
      ordem: i + 1,
    };
  });
}

/**
 * `- \`slug\` — texto` — formato dos guardrails.
 *
 * O texto pode continuar nas linhas seguintes, indentado, como qualquer item de
 * lista em markdown. Casar só até o fim da linha física cortava a regra ao meio
 * — "nunca prometer aprovação garantida de crédito **ou**" foi para o banco
 * assim, e de lá para o pacote que orienta quem faz a arte.
 */
export function extrairGuardrails(
  corpo: string,
): { slug: string; corpo: string }[] {
  const itens = [...corpo.matchAll(/^- `([a-z-]+)` — (.+(?:\n[ \t]+\S.*)*)/gm)];
  if (itens.length === 0)
    throw new Error("bloco de guardrails sem nenhuma restrição");
  return itens.map((m) => ({
    slug: m[1],
    // A quebra é de formatação, não de sentido: vira espaço.
    corpo: m[2].replace(/\s*\n\s*/g, " ").trim(),
  }));
}

export interface TemaLido {
  codigo: string;
  categoria: string;
  titulo: string;
  angulo: string | null;
}

/**
 * Tabelas por categoria: `**A. Documentação…**` e depois `| \`A1\` | tema |`.
 * O código vem do documento e é gravado como está — nunca recalculado a partir
 * da posição, que é o que faria as citações dos briefs antigos apontarem para
 * o tema errado.
 */
export function extrairTemas(corpo: string): TemaLido[] {
  const temas: TemaLido[] = [];
  let categoria = "";

  for (const linha of corpo.split("\n")) {
    const cabecalho = /^\*\*([A-F]\. .+?)\*\*$/.exec(linha.trim());
    if (cabecalho) {
      categoria = cabecalho[1];
      continue;
    }
    const item = /^\|\s*`([A-F]\d+)`\s*\|\s*(.+?)\s*\|$/.exec(linha.trim());
    if (!item) continue;
    if (!categoria)
      throw new Error(`tema ${item[1]} apareceu antes de qualquer categoria`);

    const [titulo, angulo] = item[2].split(" — ");
    temas.push({
      codigo: item[1],
      categoria,
      titulo: titulo.trim(),
      angulo: angulo?.trim() ?? null,
    });
  }

  if (temas.length === 0) throw new Error("bloco de temas sem nenhum tema");
  return temas;
}

export async function lerVaultDaAvanz(): Promise<BlocoLido[]> {
  return lerBlocos(await readFile(DOC_VAULT, "utf8"));
}
