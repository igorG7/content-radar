/**
 * Importa briefs, scans e ledger do store de arquivos para o banco.
 *
 * Produz um **relatório de reconciliação** (docs/design-migracao.md §5) em vez
 * de logar avisos no meio da saída — a carga roda contra cópia várias vezes até
 * as contagens baterem, e é o relatório que a pessoa lê antes de confiar.
 *
 * Aviso não trava; referência órfã trava. Um brief citando tema que não existe
 * ou pilar sem correspondência não é ambiguidade, é quebra — e é o que a chave
 * estrangeira composta recusaria de qualquer forma, só que no meio da carga.
 */

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { storeDeArquivo, type Brief } from "../../lib/store";
import * as schema from "../schema";

/**
 * Os códigos antigos embutem a posição (`2-decisao`), que é justamente a parte
 * que faz renomear quebrar referência. Os novos são slugs estáveis.
 */
const PILAR_ANTIGO_PARA_NOVO: Record<string, string> = {
  "1-imovel": "imovel-da-semana",
  "2-decisao": "decisao-inteligente",
  "3-inteligencia": "inteligencia-imobiliaria",
  "4-bastidor": "bastidor",
  "5-quem-comprou": "quem-comprou",
  "6-mercado-rmbh": "mercado-rmbh",
};

export interface Divergencia {
  onde: string;
  detalhe: string;
}

export interface RelatorioImportacao {
  briefs: number;
  candidatas: number;
  scans: number;
  eventos: number;
  /** Contagens por estado, para comparar com o store de arquivos. */
  porEstado: Record<string, number>;
  /** Quantos saíram sem foto — normal, mas vale ver a proporção. */
  semFoto: number;
  /** Não travam a carga: ficam registrados para leitura. */
  avisos: Divergencia[];
  /** Travam: a carga não roda enquanto existirem. */
  orfas: Divergencia[];
}

/** `§B10` e `§D19` na justificativa do score apontam para o banco de temas. */
function citacoesDeTema(brief: Brief): string[] {
  const texto = [
    brief.whyMatch,
    ...brief.relevanceHints.map((h) => h.evidence),
  ].join(" ");
  return [...texto.matchAll(/§([A-F]\d+)/g)].map((m) => m[1]);
}

/**
 * Quem decidiu a arte, e quando. No arquivo, `hero_choice: null` não distingue
 * "o briefer gravou o padrão" de "o humano decidiu não usar foto" — mas a
 * saída de pendente-aprovacao só acontece por decisão humana, então o carimbo
 * da transição é a prova que faltava. Brief ainda na fila fica sem decisão.
 */
function decisaoDaArte(brief: Brief): {
  indice: number | null;
  em: Date | null;
} {
  const saiuDaFila = brief.state !== "pendente-aprovacao";
  const carimbo = brief.approvedAt ?? brief.rejectedAt ?? brief.updatedAt;
  return {
    indice: typeof brief.heroChoice === "number" ? brief.heroChoice : null,
    em: saiuDaFila && carimbo ? new Date(carimbo) : null,
  };
}

export async function importar(
  ambienteId: string,
  urlDono = process.env.DATABASE_URL_MIGRATIONS,
): Promise<RelatorioImportacao> {
  if (!urlDono) throw new Error("DATABASE_URL_MIGRATIONS ausente");

  const store = storeDeArquivo();
  const listagens = await store.listarTodos();
  const briefs = listagens.flatMap((l) => l.briefs);
  const { events, malformedLines } = await store.lerLedger();

  const avisos: Divergencia[] = [];
  const orfas: Divergencia[] = [];

  for (const listagem of listagens) {
    for (const falha of listagem.failures) {
      orfas.push({
        onde: falha.filePath,
        detalhe: `não foi possível ler: ${falha.message}`,
      });
    }
  }
  if (malformedLines.length > 0) {
    avisos.push({
      onde: "ledger",
      detalhe: `${malformedLines.length} linha(s) ilegíveis, ignoradas: ${malformedLines.join(", ")}`,
    });
  }

  const pool = new Pool({ connectionString: urlDono });
  const db = drizzle(pool, { schema });

  try {
    return await db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('app.ambiente', ${ambienteId}, true)`,
      );

      const pilares = new Set(
        (await tx.select().from(schema.pilar)).map((p) => p.slug),
      );
      const publicos = new Set(
        (await tx.select().from(schema.publico)).map((p) => p.slug),
      );
      const temas = new Set(
        (await tx.select().from(schema.tema)).map((t) => t.codigo),
      );

      if (pilares.size === 0) {
        throw new Error(
          "vault vazio: semeie os pilares antes de importar briefs",
        );
      }

      // ── reconciliação, antes de escrever qualquer coisa ──────────────────
      for (const brief of briefs) {
        const novo = brief.pillar
          ? PILAR_ANTIGO_PARA_NOVO[brief.pillar]
          : undefined;
        if (!brief.pillar) {
          orfas.push({ onde: brief.briefId, detalhe: "sem pilar declarado" });
        } else if (!novo) {
          orfas.push({
            onde: brief.briefId,
            detalhe: `pilar sem tradução: ${brief.pillar}`,
          });
        } else if (!pilares.has(novo)) {
          orfas.push({
            onde: brief.briefId,
            detalhe: `pilar inexistente no vault: ${novo}`,
          });
        }

        if (!brief.icp) {
          orfas.push({ onde: brief.briefId, detalhe: "sem público declarado" });
        } else if (!publicos.has(brief.icp)) {
          orfas.push({
            onde: brief.briefId,
            detalhe: `público inexistente no vault: ${brief.icp}`,
          });
        }

        if (!brief.topicHash) {
          orfas.push({
            onde: brief.briefId,
            detalhe: "sem topic_hash — a anti-repetição depende dele",
          });
        }
        if (!brief.headline) {
          orfas.push({ onde: brief.briefId, detalhe: "sem headline" });
        }

        for (const codigo of citacoesDeTema(brief)) {
          if (!temas.has(codigo)) {
            orfas.push({
              onde: brief.briefId,
              detalhe: `cita o tema §${codigo}, que não existe no banco de temas`,
            });
          }
        }
      }

      if (orfas.length > 0) {
        // Rollback: metade importada é pior que nada, porque parece completo.
        throw Object.assign(
          new Error("importação interrompida por referência órfã"),
          {
            relatorio: {
              briefs: 0,
              candidatas: 0,
              scans: 0,
              eventos: 0,
              porEstado: {},
              semFoto: 0,
              avisos,
              orfas,
            },
          },
        );
      }

      // ── scans ────────────────────────────────────────────────────────────
      const refsDeScan = new Set<string>();
      for (const brief of briefs)
        if (brief.scanId) refsDeScan.add(brief.scanId);
      for (const evento of events)
        if (evento.scan_id) refsDeScan.add(evento.scan_id);

      const idDoScan = new Map<string, string>();
      for (const ref of [...refsDeScan].sort()) {
        const inicio = events.find(
          (e) => e.scan_id === ref && e.event === "scan-started",
        );
        const fim = events.find(
          (e) => e.scan_id === ref && e.event === "scan-finished",
        );
        const extra = (inicio?.extra ?? {}) as Record<string, unknown>;

        const [linha] = await tx
          .insert(schema.scan)
          .values({
            ambienteId,
            scanRef: ref,
            escopo:
              typeof extra.scope === "string" ? extra.scope : "desconhecido",
            pilarFiltro:
              typeof extra.pillar_filter === "string"
                ? (PILAR_ANTIGO_PARA_NOVO[extra.pillar_filter] ??
                  extra.pillar_filter)
                : null,
            alvoQtd:
              typeof extra.target_count === "number"
                ? extra.target_count
                : null,
            estado: fim ? "concluido" : "falhou",
            iniciadoEm: inicio ? new Date(inicio.ts) : new Date(),
            encerradoEm: fim ? new Date(fim.ts) : null,
          })
          .onConflictDoUpdate({
            target: [schema.scan.ambienteId, schema.scan.scanRef],
            set: { estado: fim ? "concluido" : "falhou" },
          })
          .returning({ id: schema.scan.id });
        idDoScan.set(ref, linha.id);
      }

      // ── briefs e candidatas ──────────────────────────────────────────────
      const idDoBrief = new Map<string, string>();
      let candidatas = 0;

      for (const brief of briefs) {
        const arte = decisaoDaArte(brief);
        const [linha] = await tx
          .insert(schema.brief)
          .values({
            ambienteId,
            briefId: brief.briefId,
            slug: brief.slug,
            estado: brief.state,
            pilarSlug: PILAR_ANTIGO_PARA_NOVO[brief.pillar!],
            publicoSlug: brief.icp!,
            matchScore: brief.matchScore?.toFixed(2) ?? null,
            borderline: brief.borderline,
            borderlineMotivo: brief.borderlineReason ?? null,
            topicHash: brief.topicHash!,
            headline: brief.headline!,
            hook: brief.hook ?? null,
            captionDraft: brief.captionDraft ?? null,
            cta: brief.cta ?? null,
            hashtags: brief.hashtags,
            scoreDetalhe: brief.matchScoreBreakdown ?? null,
            evidencias: brief.relevanceHints,
            origem: {
              scope: brief.scope ?? null,
              origin: brief.origin ?? null,
              why_match: brief.whyMatch ?? null,
              source_urls: brief.sourceUrls,
              source_excerpts: brief.sourceExcerpts,
            },
            visualBrief: brief.visualBrief ?? null,
            destinoOd: {
              od_skill_ref: brief.odSkillRef ?? null,
              alternativas: brief.odSkillAlternatives,
              format: brief.format ?? null,
              suggested_slot: brief.suggestedSlot ?? null,
            },
            heroIndice: arte.indice,
            heroDecididoEm: arte.em,
            scanId: brief.scanId ? (idDoScan.get(brief.scanId) ?? null) : null,
            reviewNotes: brief.reviewNotes ?? null,
            criadoEm: brief.createdAt ? new Date(brief.createdAt) : new Date(),
            atualizadoEm: brief.updatedAt
              ? new Date(brief.updatedAt)
              : new Date(),
            handoffEm: brief.handoffAt ? new Date(brief.handoffAt) : null,
            publicadoEm: brief.publishedAt ? new Date(brief.publishedAt) : null,
            igPostUrl: brief.igPostUrl ?? null,
          })
          .onConflictDoUpdate({
            target: [schema.brief.ambienteId, schema.brief.briefId],
            set: { estado: brief.state, atualizadoEm: new Date() },
          })
          .returning({ id: schema.brief.id });

        idDoBrief.set(brief.briefId, linha.id);

        for (const candidata of brief.candidates) {
          await tx
            .insert(schema.briefCandidata)
            .values({
              ambienteId,
              briefId: linha.id,
              indice: candidata.index,
              imageUrl: candidata.imageUrl ?? null,
              objetoPath: candidata.fileName ?? null,
              cloudUrl: candidata.cloudUrl ?? null,
              alt: candidata.alt ?? null,
              licenseHint: candidata.licenseHint ?? null,
              licensable: candidata.licensable ?? null,
            })
            .onConflictDoNothing();
          candidatas++;
        }
      }

      // ── ledger ───────────────────────────────────────────────────────────
      // Reimportar não pode duplicar: o append-only vale para a operação, não
      // para a carga, então o histórico é substituído por inteiro.
      await tx.delete(schema.evento);

      const estados = new Set([
        "pendente-aprovacao",
        "pendente-publicacao",
        "publicado",
        "rejeitado",
      ]);
      const estadoDe = (dir: string | null | undefined) => {
        const nome = dir?.split("/").pop();
        return nome && estados.has(nome)
          ? (nome as (typeof schema.brief.estado)["enumValues"][number])
          : null;
      };

      let eventos = 0;
      for (const evento of events) {
        await tx.insert(schema.evento).values({
          ambienteId,
          ts: new Date(evento.ts),
          tipo: evento.event,
          // O ator fica como texto: skills e agentes nunca foram contas, e
          // atribuí-los a um usuário seria fabricar procedência.
          ator: evento.actor ?? "desconhecido",
          briefId: evento.brief_id
            ? (idDoBrief.get(evento.brief_id) ?? null)
            : null,
          scanId: evento.scan_id
            ? (idDoScan.get(evento.scan_id) ?? null)
            : null,
          deEstado: estadoDe(evento.from_dir),
          paraEstado: estadoDe(evento.to_dir),
          extra: evento.extra ?? {},
        });
        eventos++;
      }

      const porEstado: Record<string, number> = {};
      for (const brief of briefs)
        porEstado[brief.state] = (porEstado[brief.state] ?? 0) + 1;

      return {
        briefs: briefs.length,
        candidatas,
        scans: idDoScan.size,
        eventos,
        porEstado,
        semFoto: briefs.filter(
          (b) => b.heroChoice === null || b.heroChoice === undefined,
        ).length,
        avisos,
        orfas,
      };
    });
  } finally {
    await pool.end();
  }
}
