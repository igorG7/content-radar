import "server-only";

/**
 * Traz para o banco o que a execução produziu no workspace.
 *
 * Numa transação só: ou a saída inteira do scan entra, ou nada entra. Metade
 * ingerida é pior que nada — a fila mostraria briefs sem os eventos que
 * explicam de onde vieram, e o operador não teria como saber que faltou.
 *
 * As mesmas checagens do importador valem aqui, e pelo mesmo motivo: um brief
 * citando tema que não existe ou classificado num pilar que saiu do vault é
 * quebra, não ambiguidade. A diferença é que aqui o autor é um agente, e agente
 * inventa código com mais facilidade que um arquivo antigo.
 */

import { mkdir, copyFile, readdir } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { comAmbiente, type Tx } from "./cliente";
import * as t from "./schema";
import { RADAR_ROOT } from "../lib/manifest";
import { topicHash } from "../lib/anti-repeticao/topico";
import { colher, type Workspace } from "./workspace";

export interface RelatorioIngestao {
  eventos: number;
  briefs: number;
  candidatas: number;
  midiaCopiada: number;
  /** Recusas: nada foi gravado enquanto houver uma. */
  recusas: { onde: string; detalhe: string }[];
  /**
   * O que entrou, mas incompleto.
   *
   * Separado de `recusas` de propósito: jogar fora 25 minutos de execução
   * porque falta um campo editável à mão seria pior que aceitar e avisar. Mas
   * aceitar calado é como a primeira varredura bem-sucedida entregou um brief
   * sem legenda sem ninguém notar até abrir a tela.
   */
  avisos: { onde: string; detalhe: string }[];
  /**
   * O veredito do próprio pipeline, lido do ledger que ele escreveu.
   *
   * Existe porque "o executor não lançou exceção" não é o mesmo que "a
   * varredura deu certo": a skill pode abortar sozinha — sem busca disponível,
   * sem achado, sem pauta — e terminar de forma limpa. Sem isto o banco diz
   * `concluido` enquanto o ledger diz abortado, e as duas versões convivem.
   */
  abortadaPelaSkill: { motivo: string } | null;
}

/**
 * Os nomes que o modelo usa quando não usa os do schema.
 *
 * A execução que estreou o contrato `.json` gravou `caption` em vez de
 * `caption_draft`, `media` em vez de `hero_image_candidates`, e enfiou
 * `od_skill_ref` dentro de `visual_brief`. Tirar a prosa do caminho resolveu
 * *onde* o campo mora; não resolveu *como* ele se chama.
 *
 * Aceitar um apelido conhecido custa uma linha e salva 25 minutos de execução.
 * Cada uso vira aviso, para a lista não crescer sem ninguém perceber — se ela
 * começar a crescer, a resposta deixa de ser apelido e passa a ser validação.
 */
const APELIDOS: Record<string, string[]> = {
  caption_draft: ["caption"],
  hero_image_candidates: ["media"],
  od_skill_ref: ["open_design_skill"],
  why_match: ["match_reason", "porque"],
  source_urls: ["source"],
};

/** Lê o campo pelo nome do schema, ou por um apelido conhecido. */
function campo(
  data: Record<string, unknown>,
  nome: string,
): { valor: unknown; apelido?: string } {
  if (data[nome] !== undefined) return { valor: data[nome] };

  for (const alt of APELIDOS[nome] ?? []) {
    if (data[alt] !== undefined) return { valor: data[alt], apelido: alt };
  }

  // `od_skill_ref` costuma vir aninhado na direção de arte.
  const visual = (data.visual_brief ?? {}) as Record<string, unknown>;
  if (nome === "od_skill_ref") {
    for (const alt of ["od_skill_ref", "open_design_skill"]) {
      if (visual[alt] !== undefined) {
        return { valor: visual[alt], apelido: `visual_brief.${alt}` };
      }
    }
  }
  return { valor: undefined };
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}

/**
 * `§B10` na justificativa aponta para o banco de temas do pilar do brief.
 *
 * Qualquer letra, não só as categorias que existem hoje: se o agente inventar
 * `§Z99`, a checagem precisa **ver** a citação para poder recusá-la. Restringir
 * o padrão ao que existe torna o código inventado invisível — que é o oposto do
 * que a verificação serve.
 */
function citacoes(texto: string): string[] {
  return [...texto.matchAll(/§([A-Z]\d+)/g)].map((m) => m[1]);
}

export async function ingerir(ws: Workspace): Promise<RelatorioIngestao> {
  const colheita = await colher(ws);

  return comAmbiente(ws.ambienteId, async (tx: Tx) => {
    const [pilares, publicos, temas] = await Promise.all([
      tx.select({ slug: t.pilar.slug }).from(t.pilar),
      tx.select({ slug: t.publico.slug }).from(t.publico),
      tx
        .select({ pilarSlug: t.tema.pilarSlug, codigo: t.tema.codigo })
        .from(t.tema),
    ]);
    const temPilar = new Set(pilares.map((p) => p.slug));
    const temPublico = new Set(publicos.map((p) => p.slug));
    const temTema = new Set(temas.map((x) => `${x.pilarSlug}:${x.codigo}`));

    const recusas: RelatorioIngestao["recusas"] = [];
    const avisos: RelatorioIngestao["avisos"] = [];
    const analisados = colheita.briefsNovos.map((b) => ({
      slug: b.slug,
      data: b.dados,
      origem: b.origem,
    }));

    // ── reconciliação, antes de escrever ────────────────────────────────────
    for (const { slug, data, origem } of analisados) {
      if (origem === "frontmatter") {
        avisos.push({
          onde: slug,
          detalhe:
            "lido do markdown, não do .json — campos podem ter ficado no corpo",
        });
      }
      const pilar = str(data.pillar);
      const publico = str(data.icp);

      if (!pilar || !temPilar.has(pilar)) {
        recusas.push({
          onde: slug,
          detalhe: `pilar inexistente no vault: ${pilar ?? "(ausente)"}`,
        });
      }
      if (!publico || !temPublico.has(publico)) {
        recusas.push({
          onde: slug,
          detalhe: `público inexistente no vault: ${publico ?? "(ausente)"}`,
        });
      }
      // `topic_hash` não é pedido a ninguém: é função pura da headline, e a
      // ingestão a calcula. Deixar isso com o modelo produzia hash ausente —
      // ou, pior, presente e calculado de outro jeito, que faria a
      // anti-repetição nunca casar sem acusar nada.
      if (!str(data.headline)) {
        recusas.push({ onde: slug, detalhe: "sem headline" });
      }
      // A legenda é o texto do post. Sem ela o brief entra, porque dá para
      // escrever à mão na tela de edição — mas quem aprova precisa saber que
      // vai ter de escrever.
      if (!str(campo(data, "caption_draft").valor)) {
        avisos.push({ onde: slug, detalhe: "sem rascunho de legenda" });
      }
      if (
        !Array.isArray(campo(data, "hero_image_candidates").valor) ||
        (campo(data, "hero_image_candidates").valor as unknown[]).length === 0
      ) {
        avisos.push({ onde: slug, detalhe: "sem candidatas de imagem" });
      }

      const justificativa = [
        str(data.why_match) ?? "",
        JSON.stringify(data.source_relevance_hints ?? ""),
      ].join(" ");
      for (const codigo of citacoes(justificativa)) {
        if (pilar && !temTema.has(`${pilar}:${codigo}`)) {
          recusas.push({
            onde: slug,
            detalhe: `cita o tema §${codigo}, que não existe no banco de ${pilar}`,
          });
        }
      }
    }

    if (recusas.length > 0) {
      // O throw desfaz a transação: nem os eventos entram, porque um ledger que
      // registra um scan cujos briefs não existem descreve algo que não houve.
      throw Object.assign(new Error("ingestão recusada"), {
        relatorio: {
          eventos: 0,
          avisos: [],
          abortadaPelaSkill: null,
          briefs: 0,
          candidatas: 0,
          midiaCopiada: 0,
          recusas,
        },
      });
    }

    // ── scan da execução ────────────────────────────────────────────────────
    const refScan = colheita.eventos.map((e) => str(e.scan_id)).find(Boolean);
    let scanId: string | null = null;
    if (refScan) {
      const [linha] = await tx
        .select({ id: t.scan.id })
        .from(t.scan)
        .where(eq(t.scan.scanRef, refScan));
      scanId = linha?.id ?? null;
    }

    // ── briefs ──────────────────────────────────────────────────────────────
    const idPorRef = new Map<string, string>();
    let candidatas = 0;
    let midiaCopiada = 0;

    // Cache **deste** ambiente, fora do store congelado. Antes era um
    // diretório só para todos: dois clientes com arquivo de mesmo nome se
    // sobrescreviam, e o nome sai do brief_ref, que cada ambiente numera do 1.
    const [amb] = await tx
      .select({ prefixo: t.ambiente.prefixoMidia })
      .from(t.ambiente)
      .where(eq(t.ambiente.id, ws.ambienteId));
    const destinoMidia = path.join(
      RADAR_ROOT,
      "var",
      amb?.prefixo ?? `midia/${ws.ambienteId}`,
      "pendente-aprovacao",
    );
    await mkdir(destinoMidia, { recursive: true });

    for (const { slug, data, origem } of analisados) {
      if (origem === "frontmatter") {
        avisos.push({
          onde: slug,
          detalhe:
            "lido do markdown, não do .json — campos podem ter ficado no corpo",
        });
      }
      const [linha] = await tx
        .insert(t.brief)
        .values({
          ambienteId: ws.ambienteId,
          briefId: str(data.brief_id) ?? slug,
          slug,
          estado: "pendente-aprovacao",
          pilarSlug: str(data.pillar)!,
          publicoSlug: str(data.icp)!,
          matchScore: num(data.match_score)?.toFixed(2) ?? null,
          borderline: data.borderline === true,
          borderlineMotivo: str(data.borderline_reason) ?? null,
          topicHash: topicHash(str(data.headline) ?? slug),
          // O aviso acompanha o brief, não a varredura: quem decide publicar
          // abre o brief, e o evento do scan some da vista na semana seguinte.
          avisos: avisos.filter((a) => a.onde === slug).map((a) => a.detalhe),
          headline: str(data.headline)!,
          hook: str(data.hook) ?? null,
          captionDraft: str(campo(data, "caption_draft").valor) ?? null,
          cta: str(data.cta) ?? null,
          hashtags: Array.isArray(data.hashtags)
            ? (data.hashtags as string[])
            : [],
          scoreDetalhe: (data.match_score_breakdown ?? null) as never,
          evidencias: (data.source_relevance_hints ?? []) as never,
          origem: {
            scope: str(data.scope) ?? null,
            why_match: str(data.why_match) ?? null,
            source_urls: data.source_urls ?? [],
            source_excerpts: data.source_excerpts ?? [],
          },
          visualBrief: (data.visual_brief ?? null) as never,
          destinoOd: {
            od_skill_ref: str(data.od_skill_ref) ?? null,
            alternativas: data.od_skill_alternatives ?? [],
            format: str(data.format) ?? null,
          },
          // Sem carimbo: o briefer gravou o padrão, ninguém decidiu ainda. É
          // exatamente a distinção que o arquivo não conseguia fazer.
          heroIndice: null,
          heroDecididoEm: null,
          scanId,
          reviewNotes: str(data.review_notes) ?? null,
        })
        .onConflictDoNothing()
        .returning({ id: t.brief.id });

      if (!linha) continue; // brief já existia: reingestão do mesmo workspace
      idPorRef.set(str(data.brief_id) ?? slug, linha.id);

      const candidatasDeclaradas = Array.isArray(data.hero_image_candidates)
        ? (data.hero_image_candidates as Record<string, unknown>[])
        : [];

      for (const c of candidatasDeclaradas) {
        const local = str(c.local_path);
        const arquivo = local ? path.basename(local) : null;

        // A mídia é binário e continua em disco: sai do workspace para o cache
        // real, que é o que a rota de imagem serve.
        if (arquivo) {
          const origem = path.join(
            ws.dir,
            "store",
            "media",
            "pendente-aprovacao",
            arquivo,
          );
          await copyFile(origem, path.join(destinoMidia, arquivo))
            .then(() => void midiaCopiada++)
            .catch(() => undefined);
        }

        await tx.insert(t.briefCandidata).values({
          ambienteId: ws.ambienteId,
          briefId: linha.id,
          indice: num(c.index) ?? 0,
          sourceUrl: str(c.source_url) ?? null,
          imageUrl: str(c.image_url) ?? null,
          objetoPath: arquivo,
          alt: str(c.alt) ?? null,
          licenseHint: str(c.license_hint) ?? null,
          licensable: typeof c.licensable === "boolean" ? c.licensable : null,
          mimeType: str(c.mime_type) ?? null,
        });
        candidatas++;
      }
    }

    // ── ledger ──────────────────────────────────────────────────────────────
    for (const e of colheita.eventos) {
      const refBrief = str(e.brief_id);
      await tx.insert(t.evento).values({
        ambienteId: ws.ambienteId,
        ts: str(e.ts) ? new Date(str(e.ts)!) : new Date(),
        tipo: str(e.event) ?? "desconhecido",
        ator: str(e.actor) ?? "skill:radar-scan",
        briefId: refBrief ? (idPorRef.get(refBrief) ?? null) : null,
        scanId,
        extra: (e.extra ?? {}) as never,
      });
    }

    return {
      eventos: colheita.eventos.length,
      avisos,
      abortadaPelaSkill: (() => {
        const aborto = colheita.eventos.find(
          (e) => str(e.event) === "scan-aborted",
        );
        if (!aborto) return null;
        const extra = (aborto.extra ?? {}) as Record<string, unknown>;
        return {
          motivo:
            str(extra.detail) ?? str(extra.reason) ?? "abortada sem detalhe",
        };
      })(),
      briefs: idPorRef.size,
      candidatas,
      midiaCopiada,
      recusas: [],
    };
  });
}

/** Quantos arquivos de mídia o workspace produziu — para conferência. */
export async function midiaDoWorkspace(ws: Workspace): Promise<number> {
  const dir = path.join(ws.dir, "store", "media", "pendente-aprovacao");
  return (await readdir(dir).catch(() => [] as string[])).length;
}
