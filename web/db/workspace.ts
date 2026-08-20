import "server-only";

/**
 * Materializa, num diretório temporário, o mundo de arquivos que as skills
 * esperam — reconstruído do banco, para o ambiente da execução.
 *
 * É a fase 4 da migração: as skills continuam abrindo `manifest.yaml`, os
 * arquivos do vault e os diretórios de briefs, mas nada disso é mais o store
 * compartilhado. Cada execução recebe o seu, e o `env_id` deixa de depender de
 * o agente escolher o caminho certo — ele não tem outro caminho.
 *
 * Duas propriedades que o desenho exige:
 *
 * - **Snapshot.** O vault é congelado no início do scan; mudança no meio não
 *   afeta a execução em curso (spec 005 §20 gotcha 5). Materializar dá isso de
 *   graça: o que foi escrito no disco é o que a skill vê.
 * - **Isolamento por construção.** Um workspace por ambiente, com caminho
 *   montado num lugar só. O agente não tem como enxergar o de outro cliente
 *   porque ele não está lá.
 */

import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
  cp,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { stringify } from "yaml";
import { eq } from "drizzle-orm";
import { comAmbiente } from "./cliente";
import * as t from "./schema";
import { BRIEF_STATES, RADAR_ROOT } from "../lib/manifest";

/** Nomes dos arquivos do vault, na ordem de montagem. */
const ARQUIVO_DO_BLOCO = (slug: string) => `vault/${slug}.md`;

export interface Workspace {
  dir: string;
  ambienteId: string;
  /** Quantas skills o workspace carrega — do produto, não do cliente. */
  skills: number;
  /** Quantos briefs foram materializados para a anti-repetição. */
  briefs: number;
  blocos: number;
}

/**
 * O manifest que a skill vai ler. Não é o do repositório: é gerado do banco,
 * com os caminhos apontando para dentro do próprio workspace.
 */
function montarManifest(
  dir: string,
  ambienteSlug: string,
  slugs: string[],
  marca: {
    canalPrincipal: string;
    telefoneExibicao: string | null;
    telefoneE164: string | null;
    telefoneSecundarioE164: string | null;
  } | null,
  pilaresComTemplate: string[],
  config: {
    pesos: unknown;
    caps: Record<string, unknown>;
    janelas: unknown;
    volume: Record<string, unknown>;
  },
  escopos: {
    slug: string;
    label: string;
    fontes: string[];
    pilares: string[];
  }[],
) {
  const caps = config.caps as Record<string, number>;
  return {
    project: { name: "content-radar", status: "execucao" },
    target_company: {
      slug: ambienteSlug,
      // Aponta para dentro do workspace: a skill lê o vault materializado, e
      // não tem como alcançar o de outro ambiente.
      vault_path: path.join(dir, "vault"),
      always_load: slugs.map(ARQUIVO_DO_BLOCO),
      // Valores, não prosa: a skill injeta o telefone no must_have da arte e no
      // package. Vêm da tabela `marca`, não de parsear o bloco de contato.
      brand_facts: {
        main_channel: marca?.canalPrincipal ?? "WhatsApp",
        phone_display: marca?.telefoneExibicao ?? null,
        phone_e164: marca?.telefoneE164 ?? null,
        phone_secondary_e164: marca?.telefoneSecundarioE164 ?? null,
      },
      per_pillar: Object.fromEntries(
        pilaresComTemplate.map((slug) => [
          slug,
          [`prompts/post-${slug}.json`, "prompts/visual-base.json"],
        ]),
      ),
    },
    storage: {
      briefs_root: "store/briefs",
      briefs_dirs: {
        pendente_aprovacao: "pendente-aprovacao",
        pendente_publicacao: "pendente-publicacao",
        publicado: "publicado",
        rejeitado: "rejeitado",
      },
      media_root: "store/media",
      media_dirs: {
        pendente_aprovacao: "pendente-aprovacao",
        pendente_publicacao: "pendente-publicacao",
        publicado: "publicado",
        rejeitado: "rejeitado",
      },
      ledger: "store/ledger.jsonl",
      packages_root: "store/packages",
    },
    search_scopes: Object.fromEntries(
      escopos.map((e) => [
        e.slug,
        { label: e.label, sources: e.fontes, pillars_alvo: e.pilares },
      ]),
    ),
    funnel: {
      candidates_per_week_target: config.volume.candidates_per_week_target,
      publication_per_week_reference: config.volume.posts_por_semana,
    },
    anti_repetition: {
      match_score_min: caps.match_score_min,
      borderline_min: caps.borderline_min,
      geografia_reframe_floor: caps.geografia_reframe_floor,
      match_score_weights: config.pesos,
      match_score_caps: {
        pillar_fit_min: caps.pillar_fit_min,
        foco_and_geo_combined_min: caps.foco_and_geo_combined_min,
        icp_ambiguous_cap: caps.icp_ambiguous_cap,
      },
      windows: config.janelas,
      // §11.J: pauta redundante é pulada em silêncio, não vira brief.
      redundant_policy: "skip",
      // spec 003 §8: o matcher checa por título, o briefer por headline.
      dual_check: { matcher_uses: "title", briefer_uses: "headline" },
    },
  };
}

/**
 * Frontmatter mínimo para a anti-repetição. A skill compara `topic_hash`,
 * pilar, público e data — não precisa da legenda nem do briefing visual, e
 * mandar o brief inteiro só aumentaria o contexto sem mudar a decisão.
 */
function frontmatterDeAntiRepeticao(b: {
  briefId: string;
  slug: string;
  headline: string;
  pilarSlug: string;
  publicoSlug: string;
  topicHash: string;
  criadoEm: Date;
}) {
  return `---\n${stringify(
    {
      brief_id: b.briefId,
      slug: b.slug,
      headline: b.headline,
      pillar: b.pilarSlug,
      icp: b.publicoSlug,
      topic_hash: b.topicHash,
      created_at: b.criadoEm.toISOString(),
    },
    { lineWidth: 0 },
  )}---\n`;
}

export async function materializar(ambienteId: string): Promise<Workspace> {
  const dir = await mkdtemp(path.join(tmpdir(), "radar-scan-"));

  return comAmbiente(ambienteId, async (tx) => {
    const [amb] = await tx
      .select()
      .from(t.ambiente)
      .where(eq(t.ambiente.id, ambienteId));
    const ambienteSlug = amb?.slug ?? "desconhecido";

    const [
      blocos,
      pilares,
      publicos,
      temas,
      guardrails,
      escoposDb,
      fontes,
      escopoPilar,
      cfg,
      briefs,
      marcas,
    ] = await Promise.all([
      tx.select().from(t.vaultBloco).orderBy(t.vaultBloco.ordem),
      tx.select().from(t.pilar).orderBy(t.pilar.ordem),
      tx.select().from(t.publico),
      tx.select().from(t.tema),
      tx.select().from(t.guardrail),
      tx.select().from(t.escopoBusca),
      tx.select().from(t.fonte),
      tx.select().from(t.escopoPilar),
      tx.select().from(t.config),
      tx.select().from(t.brief),
      tx.select().from(t.marca),
    ]);

    const preenchidos = blocos.filter((b) => b.corpo !== "");
    if (preenchidos.length === 0) {
      await rm(dir, { recursive: true, force: true });
      throw new Error("vault vazio: não há o que injetar");
    }
    if (!cfg[0]) {
      await rm(dir, { recursive: true, force: true });
      throw new Error("ambiente sem configuração");
    }

    await mkdir(path.join(dir, "vault"), { recursive: true });

    // Um arquivo por bloco, com o título como cabeçalho. Os blocos com
    // identidade ganham a lista logo abaixo da prosa — é onde os códigos que
    // os briefs citam precisam estar visíveis para o agente.
    for (const bloco of preenchidos) {
      const extra: string[] = [];
      if (bloco.slug === "pilares") {
        extra.push(
          "",
          "## Códigos em uso",
          ...pilares.map(
            (p) =>
              `- \`${p.slug}\`${p.noRadar ? "" : " — fora do escopo do radar"}`,
          ),
        );
      }
      if (bloco.slug === "publicos") {
        extra.push(
          "",
          "## Códigos em uso",
          ...publicos.map(
            (p) => `- \`${p.slug}\`${p.padrao ? " (default)" : ""}`,
          ),
        );
      }
      if (bloco.slug === "guardrails") {
        extra.push(
          "",
          "## Restrições operáveis",
          ...guardrails.map((g) => `- \`${g.slug}\` — ${g.corpo}`),
        );
      }
      if (bloco.slug === "temas") {
        extra.push(
          "",
          "## Temas disponíveis",
          ...temas
            .filter((tema) => tema.esgotadoEm === null)
            .map(
              (tema) =>
                `- \`${tema.codigo}\` (${tema.pilarSlug}) — ${tema.titulo}`,
            ),
        );
      }

      await writeFile(
        path.join(dir, ARQUIVO_DO_BLOCO(bloco.slug)),
        `# ${bloco.titulo}\n\n${bloco.corpo}\n${extra.join("\n")}`,
        "utf8",
      );
    }

    // Templates de geração: um por pilar, mais a base compartilhada.
    await mkdir(path.join(dir, "prompts"), { recursive: true });
    const comTemplate: string[] = [];

    if (cfg[0]?.visualBase) {
      await writeFile(
        path.join(dir, "prompts", "visual-base.json"),
        JSON.stringify(cfg[0].visualBase, null, 2),
        "utf8",
      );
    }
    for (const pilar of pilares) {
      if (!pilar.template) continue;
      await writeFile(
        path.join(dir, "prompts", `post-${pilar.slug}.json`),
        JSON.stringify(pilar.template, null, 2),
        "utf8",
      );
      comTemplate.push(pilar.slug);
    }

    const escopos = escoposDb
      .filter((e) => e.ativo)
      .map((e) => ({
        slug: e.slug,
        label: e.label,
        fontes: fontes
          .filter((f) => f.escopoSlug === e.slug && f.ativo)
          .map((f) => f.slug),
        pilares: escopoPilar
          .filter((p) => p.escopoSlug === e.slug)
          .map((p) => p.pilarSlug),
      }));

    await writeFile(
      path.join(dir, "manifest.yaml"),
      stringify(
        montarManifest(
          dir,
          ambienteSlug,
          preenchidos.map((b) => b.slug),
          marcas[0] ?? null,
          comTemplate,
          cfg[0] as never,
          escopos,
        ),
        { lineWidth: 0 },
      ),
      "utf8",
    );

    // Os quatro diretórios existem mesmo vazios: a skill lista todos, e
    // diretório ausente vira erro de leitura no meio da execução.
    for (const estado of BRIEF_STATES) {
      await mkdir(path.join(dir, "store", "briefs", estado), {
        recursive: true,
      });
      await mkdir(path.join(dir, "store", "media", estado), {
        recursive: true,
      });
    }

    for (const brief of briefs) {
      await writeFile(
        path.join(dir, "store", "briefs", brief.estado, `${brief.slug}.md`),
        frontmatterDeAntiRepeticao(brief),
        "utf8",
      );
    }

    // As skills e subagentes vêm do repositório: são do produto, iguais para
    // todo cliente. O Agent SDK os carrega a partir do diretório de trabalho,
    // então precisam estar aqui — o que é do cliente já veio do banco.
    await cp(path.join(RADAR_ROOT, ".claude"), path.join(dir, ".claude"), {
      recursive: true,
    });

    // O ledger nasce vazio: o que a skill escrever aqui é o que a ingestão
    // leva de volta para o banco. Misturar com o histórico faria a ingestão
    // ter de adivinhar o que é novo.
    await writeFile(path.join(dir, "store", "ledger.jsonl"), "", "utf8");

    const skills = (
      await readdir(path.join(dir, ".claude", "skills")).catch(() => [])
    ).length;

    return {
      dir,
      ambienteId,
      skills,
      briefs: briefs.length,
      blocos: preenchidos.length,
    };
  });
}

export async function descartar(ws: Workspace): Promise<void> {
  await rm(ws.dir, { recursive: true, force: true });
}

/** O que a execução produziu, lido de volta do workspace. */
export interface Colheita {
  eventos: Record<string, unknown>[];
  briefsNovos: {
    slug: string;
    dados: Record<string, unknown>;
    /**
     * De onde os campos vieram. `frontmatter` significa que a skill não gravou
     * o `.json` do contrato e o brief foi lido do markdown — que é onde o
     * conteúdo se perde, porque o modelo distribui os campos entre frontmatter
     * e corpo de um jeito diferente a cada execução.
     */
    origem: "json" | "frontmatter";
  }[];
}

export async function colher(ws: Workspace): Promise<Colheita> {
  const ledger = await readFile(
    path.join(ws.dir, "store", "ledger.jsonl"),
    "utf8",
  ).catch(() => "");
  const eventos = ledger
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l) as Record<string, unknown>);

  // Só a fila recebe brief novo; os outros três estados a skill não cria.
  const dirFila = path.join(ws.dir, "store", "briefs", "pendente-aprovacao");
  const nomes = await readdir(dirFila).catch(() => [] as string[]);

  const briefsNovos: Colheita["briefsNovos"] = [];

  /**
   * O `.json` é o contrato: é o objeto que o briefer devolveu, gravado como
   * veio. Duas execuções reais provaram por que o markdown não serve — numa,
   * hook, CTA, hashtags e direção de arte foram para o frontmatter; na outra,
   * para o corpo. A ingestão lê frontmatter, então metade do brief sumiu sem
   * ninguém notar.
   */
  for (const nome of nomes.filter((n) => n.endsWith(".json"))) {
    const bruto = await readFile(path.join(dirFila, nome), "utf8");
    try {
      briefsNovos.push({
        slug: nome.slice(0, -5),
        dados: JSON.parse(bruto) as Record<string, unknown>,
        origem: "json",
      });
    } catch {
      // JSON quebrado não é brief: deixar passar viraria recusa confusa lá na
      // frente, em vez de "a skill escreveu algo que não é JSON".
    }
  }

  const comJson = new Set(briefsNovos.map((b) => b.slug));

  for (const nome of nomes.filter((n) => n.endsWith(".md"))) {
    const slug = nome.slice(0, -3);
    if (comJson.has(slug)) continue;

    const conteudo = await readFile(path.join(dirFila, nome), "utf8");
    // Os materializados só têm frontmatter de anti-repetição; brief de verdade
    // tem corpo. É o que separa o que veio do banco do que a skill escreveu.
    if (
      conteudo.split("---").length > 2 &&
      conteudo.split("---")[2].trim() !== ""
    ) {
      const { parseFrontmatter } = await import("../lib/store/frontmatter");
      briefsNovos.push({
        slug,
        dados: parseFrontmatter(conteudo).data,
        origem: "frontmatter",
      });
    }
  }

  return { eventos, briefsNovos };
}
