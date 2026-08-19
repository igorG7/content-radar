import "server-only";

/**
 * Backend de Postgres da `RadarStore`. Irmão de `backendArquivo`, atrás da
 * mesma interface — é o que permite a troca sem tocar em página nenhuma.
 *
 * Toda operação passa por `comAmbiente()`, que abre transação e declara
 * `app.ambiente`. Não há caminho que escape disso: sem a declaração o banco
 * devolve zero linhas, e é assim que o isolamento deixa de depender de
 * disciplina de quem escreve consulta.
 *
 * Duas coisas continuam em arquivo, de propósito:
 *
 * - **mídia**, que é binário e nunca foi para o banco (esquema §1);
 * - **`manifest()`**, que ainda lê `manifest.yaml`. A configuração por ambiente
 *   já existe na tabela `config`, mas a tela que a edita escreve no YAML — a
 *   troca é fatia própria, e fazer meia aqui deixaria leitura e edição
 *   discordando.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { comAmbiente, type Tx } from "./cliente";
import * as t from "./schema";
import { loadManifest, MANIFEST_PATH, type BriefState } from "../lib/manifest";
import type { Brief, HeroCandidate, StateListing } from "../lib/store/briefs";
import type { LedgerEvent, LedgerReadResult } from "../lib/store/ledger";
import type { TransitionPlan, TransitionResult } from "../lib/transitions/mv";
import { TransitionError } from "../lib/transitions/mv";
import type {
  AmbienteId,
  EdicaoBrief,
  RadarStore,
  TransicaoEntrada,
} from "../lib/store";
import { StoreError } from "../lib/store";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type LinhaBrief = typeof t.brief.$inferSelect;
type LinhaCandidata = typeof t.briefCandidata.$inferSelect;

/** O app fala o vocabulário do tipo `Brief`; o banco, o das colunas. */
function paraBrief(linha: LinhaBrief, candidatas: LinhaCandidata[]): Brief {
  const origem = (linha.origem ?? {}) as Record<string, unknown>;
  const destino = (linha.destinoOd ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const arr = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  return {
    slug: linha.slug,
    briefId: linha.briefId,
    state: linha.estado,
    // Não há arquivo: o campo existe no tipo por herança do backend anterior.
    filePath: "",
    headline: linha.headline,
    hook: linha.hook ?? undefined,
    pillar: linha.pilarSlug,
    icp: linha.publicoSlug,
    scope: str(origem.scope),
    scanId: linha.scanId ?? undefined,
    createdAt: linha.criadoEm.toISOString(),
    updatedAt: linha.atualizadoEm.toISOString(),
    matchScore:
      linha.matchScore === null ? undefined : Number(linha.matchScore),
    matchScoreBreakdown: (linha.scoreDetalhe ?? undefined) as
      Record<string, number> | undefined,
    borderline: linha.borderline,
    borderlineReason: linha.borderlineMotivo ?? undefined,
    whyMatch: str(origem.why_match),
    topicHash: linha.topicHash,
    sourceUrls: arr(origem.source_urls),
    // A ambiguidade do arquivo não existe aqui: o carimbo diz se houve decisão.
    heroChoice: linha.heroDecididoEm ? linha.heroIndice : undefined,
    heroChoiceDeclared: linha.heroDecididoEm !== null,
    candidates: candidatas
      .sort((a, b) => a.indice - b.indice)
      .map((c): HeroCandidate => ({
        index: c.indice,
        fileName: c.objetoPath,
        exists: c.objetoPath !== null,
        imageUrl: c.imageUrl ?? undefined,
        alt: c.alt ?? undefined,
        licenseHint: c.licenseHint ?? undefined,
        licensable: c.licensable ?? undefined,
        cloudUrl: c.cloudUrl,
      })),
    warnings: [],
    captionDraft: linha.captionDraft ?? undefined,
    hashtags: linha.hashtags ?? [],
    cta: linha.cta ?? undefined,
    suggestedSlot: str(destino.suggested_slot),
    format: str(destino.format),
    odSkillRef: str(destino.od_skill_ref),
    odSkillAlternatives: arr(destino.alternativas),
    sourceExcerpts: arr(origem.source_excerpts),
    reviewNotes: linha.reviewNotes ?? undefined,
    visualBrief: (linha.visualBrief ?? undefined) as Brief["visualBrief"],
    relevanceHints: (linha.evidencias ?? []) as Brief["relevanceHints"],
    origin: str(origem.origin),
    handoffAt: linha.handoffEm?.toISOString(),
    publishedAt: linha.publicadoEm?.toISOString(),
    igPostUrl: linha.igPostUrl ?? undefined,
  };
}

async function listar(tx: Tx, estado: BriefState): Promise<StateListing> {
  const linhas = await tx
    .select()
    .from(t.brief)
    .where(eq(t.brief.estado, estado))
    .orderBy(desc(t.brief.criadoEm));

  const candidatas = linhas.length
    ? await tx.select().from(t.briefCandidata)
    : [];
  const porBrief = new Map<string, LinhaCandidata[]>();
  for (const c of candidatas) {
    porBrief.set(c.briefId, [...(porBrief.get(c.briefId) ?? []), c]);
  }

  return {
    state: estado,
    briefs: linhas.map((l) => paraBrief(l, porBrief.get(l.id) ?? [])),
    // Falha de leitura era um conceito de arquivo malformado; no banco, ou a
    // linha existe e é válida, ou não existe.
    failures: [],
  };
}

async function buscarLinha(tx: Tx, slug: string): Promise<LinhaBrief> {
  const [linha] = await tx.select().from(t.brief).where(eq(t.brief.slug, slug));
  if (!linha)
    throw new StoreError("nao_encontrado", `brief não encontrado: ${slug}`);
  return linha;
}

const PROXIMO_ESTADO = {
  approve: "pendente-publicacao",
  reject: "rejeitado",
} as const;

export function backendPostgres(ambiente: AmbienteId): RadarStore {
  const dentro = <T>(trabalho: (tx: Tx) => Promise<T>) =>
    comAmbiente(ambiente, trabalho);

  /** Plano e execução compartilham a leitura para não divergirem. */
  async function planejar(
    tx: Tx,
    entrada: TransicaoEntrada,
  ): Promise<TransitionPlan> {
    const linha = await buscarLinha(tx, entrada.slug);
    if (linha.estado !== "pendente-aprovacao") {
      throw new TransitionError(
        "wrong_state",
        `brief está em ${linha.estado}, não na fila`,
      );
    }
    // A regra que o arquivo não conseguia expressar: sem carimbo de decisão,
    // não há escolha humana — e aprovar sem escolha é o erro que a fila existe
    // para impedir.
    if (entrada.direcao === "approve" && linha.heroDecididoEm === null) {
      throw new TransitionError(
        "hero_choice_missing",
        "a arte ainda não foi escolhida nesta sessão",
      );
    }

    const candidatas = await tx
      .select()
      .from(t.briefCandidata)
      .where(eq(t.briefCandidata.briefId, linha.id));

    const escolhida = candidatas.find((c) => c.indice === linha.heroIndice);
    if (
      entrada.direcao === "approve" &&
      linha.heroIndice !== null &&
      !escolhida
    ) {
      throw new TransitionError(
        "hero_choice_out_of_range",
        `não existe candidata ${linha.heroIndice}`,
      );
    }

    const mantida =
      entrada.direcao === "approve" ? (escolhida?.objetoPath ?? null) : null;
    return {
      slug: linha.slug,
      briefId: linha.briefId,
      direction: entrada.direcao,
      from: linha.estado,
      to: PROXIMO_ESTADO[entrada.direcao],
      heroChoice: linha.heroIndice,
      mediaKept: mantida,
      mediaDeleted: candidatas
        .map((c) => c.objetoPath)
        .filter((p): p is string => p !== null && p !== mantida),
      warnings:
        entrada.direcao === "approve" && linha.heroIndice === null
          ? ["aprovado sem foto — o Smart Design gera a arte"]
          : [],
    };
  }

  return {
    ambiente,

    manifest: loadManifest,

    async lerManifestBruto() {
      return readFile(MANIFEST_PATH, "utf8");
    },

    async gravarManifestBruto(texto) {
      await writeFile(MANIFEST_PATH, texto, "utf8");
    },

    listarEstado: (estado) => dentro((tx) => listar(tx, estado)),
    listarFila: () => dentro((tx) => listar(tx, "pendente-aprovacao")),

    listarTodos: () =>
      dentro(async (tx) => {
        const estados: BriefState[] = [
          "pendente-aprovacao",
          "pendente-publicacao",
          "publicado",
          "rejeitado",
        ];
        const saida: StateListing[] = [];
        for (const estado of estados) saida.push(await listar(tx, estado));
        return saida;
      }),

    buscarBrief: (slug) =>
      dentro(async (tx) => {
        const linha = await buscarLinha(tx, slug);
        const candidatas = await tx
          .select()
          .from(t.briefCandidata)
          .where(eq(t.briefCandidata.briefId, linha.id));
        return paraBrief(linha, candidatas);
      }),

    planejarTransicao: (entrada) => dentro((tx) => planejar(tx, entrada)),

    /**
     * Mover, remanejar mídia e registrar no ledger numa transação só. No
     * backend de arquivo essa sequência não era atômica: falhar no meio deixava
     * o brief movido e o ledger sem o evento.
     */
    aplicarTransicao: (entrada) =>
      dentro(async (tx): Promise<TransitionResult> => {
        const linha = await buscarLinha(tx, entrada.slug);
        const plano = await planejar(tx, entrada);

        await tx
          .update(t.brief)
          .set({
            estado: plano.to,
            atualizadoEm: new Date(),
            reviewNotes: entrada.motivo ?? undefined,
          })
          .where(eq(t.brief.id, linha.id));

        // As candidatas descartadas somem do registro junto com os arquivos.
        for (const descartada of plano.mediaDeleted) {
          await tx
            .delete(t.briefCandidata)
            .where(
              and(
                eq(t.briefCandidata.briefId, linha.id),
                eq(t.briefCandidata.objetoPath, descartada),
              ),
            );
        }

        const [evento] = await tx
          .insert(t.evento)
          .values({
            ambienteId: ambiente,
            tipo: entrada.direcao === "approve" ? "mv-approved" : "mv-rejected",
            ator: entrada.ator ?? "app:radar-web",
            briefId: linha.id,
            deEstado: plano.from,
            paraEstado: plano.to,
            extra: {
              hero_choice: plano.heroChoice,
              media_kept: plano.mediaKept ?? "none",
              media_deleted: plano.mediaDeleted,
              reason: entrada.motivo ?? null,
            },
          })
          .returning();

        return {
          ...plano,
          applied: true,
          ledgerEvent: {
            ts: evento.ts.toISOString(),
            event: evento.tipo,
            actor: evento.ator,
            brief_id: plano.briefId,
            extra: evento.extra as Record<string, unknown>,
          },
        };
      }),

    gravarEscolhaHero: (slug, indice) =>
      dentro(async (tx) => {
        const linha = await buscarLinha(tx, slug);
        if (linha.estado !== "pendente-aprovacao") {
          throw new StoreError(
            "nao_encontrado",
            "brief não está em pendente-aprovacao",
          );
        }
        if (indice !== null) {
          const [candidata] = await tx
            .select()
            .from(t.briefCandidata)
            .where(
              and(
                eq(t.briefCandidata.briefId, linha.id),
                eq(t.briefCandidata.indice, indice),
              ),
            );
          if (!candidata) {
            throw new StoreError(
              "candidata_invalida",
              `não existe candidata com índice ${indice}`,
            );
          }
        }
        // O carimbo é o dado que faltava no arquivo: registra que houve decisão,
        // inclusive quando a decisão foi "sem foto".
        await tx
          .update(t.brief)
          .set({
            heroIndice: indice,
            heroDecididoEm: new Date(),
            atualizadoEm: new Date(),
          })
          .where(eq(t.brief.id, linha.id));
      }),

    editarBrief: (estado, slug, campos: EdicaoBrief) =>
      dentro(async (tx) => {
        const linha = await buscarLinha(tx, slug);
        if (linha.estado !== estado) {
          throw new StoreError(
            "nao_encontrado",
            "brief não encontrado neste estado",
          );
        }
        await tx
          .update(t.brief)
          .set({
            headline: campos.headline ?? undefined,
            hook: campos.hook ?? null,
            captionDraft: campos.caption_draft ?? null,
            cta: campos.cta ?? null,
            hashtags: campos.hashtags,
            reviewNotes: campos.review_notes ?? null,
            visualBrief: campos.visual_brief ?? linha.visualBrief,
            atualizadoEm: new Date(),
          })
          .where(eq(t.brief.id, linha.id));
      }),

    lerLedger: () =>
      dentro(async (tx): Promise<LedgerReadResult> => {
        const linhas = await tx
          .select({
            ts: t.evento.ts,
            tipo: t.evento.tipo,
            ator: t.evento.ator,
            extra: t.evento.extra,
            briefRef: t.brief.briefId,
            scanRef: t.scan.scanRef,
            de: t.evento.deEstado,
            para: t.evento.paraEstado,
          })
          .from(t.evento)
          .leftJoin(t.brief, eq(t.brief.id, t.evento.briefId))
          .leftJoin(t.scan, eq(t.scan.id, t.evento.scanId))
          .orderBy(t.evento.ts);

        return {
          events: linhas.map((l): LedgerEvent => ({
            ts: l.ts.toISOString(),
            event: l.tipo,
            actor: l.ator,
            brief_id: l.briefRef,
            scan_id: l.scanRef,
            from_dir: l.de && `briefs/${l.de}`,
            to_dir: l.para && `briefs/${l.para}`,
            extra: l.extra as Record<string, unknown>,
          })),
          // Linha malformada era conceito de JSONL; no banco não existe.
          malformedLines: [],
        };
      }),

    registrarEvento: (evento) =>
      dentro(async (tx) => {
        const [linha] = await tx
          .insert(t.evento)
          .values({
            ambienteId: ambiente,
            tipo: evento.event,
            ator: evento.actor ?? "app:radar-web",
            extra: (evento.extra ?? {}) as Record<string, unknown>,
          })
          .returning();
        return { ...evento, ts: linha.ts.toISOString() };
      }),

    // Mídia continua em disco: binário nunca foi para o banco. Some daqui
    // quando o armazenamento de objetos entrar.
    async lerMidia(estado, arquivo) {
      try {
        return Uint8Array.from(
          await readFile(await this.caminhoMidia(estado, arquivo)),
        );
      } catch (erro) {
        if ((erro as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw erro;
      }
    },

    async caminhoMidia(estado, arquivo) {
      const { resolvePaths } = await import("../lib/manifest");
      const p = resolvePaths(await loadManifest());
      return path.join(p.mediaDir[estado], path.basename(arquivo));
    },
  };
}
