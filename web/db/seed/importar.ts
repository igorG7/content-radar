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

import { and, eq, sql } from "drizzle-orm";
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
  escopos: number;
  fontes: number;
  templates: number;
  temasImportados: number;
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
      // Chaveado por pilar: o código só é único dentro do banco de um pilar —
      // `B10` existe em três. A citação do brief se resolve pelo pilar dele.
      const temas = new Set(
        (await tx.select().from(schema.tema)).map(
          (t) => `${t.pilarSlug}:${t.codigo}`,
        ),
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
          if (novo && !temas.has(`${novo}:${codigo}`)) {
            orfas.push({
              onde: brief.briefId,
              detalhe: `cita o tema §${codigo}, que não existe no banco de ${novo}`,
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
              escopos: 0,
              fontes: 0,
              templates: 0,
              temasImportados: 0,
              avisos,
              orfas,
            },
          },
        );
      }

      // ── fatos da marca e templates por pilar ─────────────────────────────
      // Vêm do manifest e do vault de arquivos. São valores estruturados que a
      // skill injeta na arte e no package — prosa não serve aqui.
      const manifestBruto = await store.lerManifestBruto();
      const { parse } = await import("yaml");
      const cru = parse(manifestBruto) as {
        target_company?: {
          vault_path?: string;
          brand_facts?: Record<string, string>;
          per_pillar?: Record<string, string[]>;
        };
      };
      const fatos = cru.target_company?.brand_facts ?? {};

      await tx
        .insert(schema.marca)
        .values({
          ambienteId,
          canalPrincipal: fatos.main_channel ?? "WhatsApp",
          telefoneExibicao: fatos.phone_display ?? null,
          telefoneE164: fatos.phone_e164 ?? null,
          telefoneSecundarioE164: fatos.phone_secondary_e164 ?? null,
        })
        .onConflictDoUpdate({
          target: schema.marca.ambienteId,
          set: {
            canalPrincipal: fatos.main_channel ?? "WhatsApp",
            telefoneExibicao: fatos.phone_display ?? null,
            telefoneE164: fatos.phone_e164 ?? null,
            telefoneSecundarioE164: fatos.phone_secondary_e164 ?? null,
            atualizadoEm: new Date(),
          },
        });

      const vaultDir = cru.target_company?.vault_path;
      let templates = 0;

      if (vaultDir) {
        const { readFile } = await import("node:fs/promises");
        const path = await import("node:path");

        const base = await readFile(
          path.join(vaultDir, "prompts", "visual-base.json"),
          "utf8",
        ).catch(() => null);
        if (base) {
          await tx
            .update(schema.config)
            .set({ visualBase: JSON.parse(base) })
            .where(eq(schema.config.ambienteId, ambienteId));
        } else {
          avisos.push({
            onde: "vault",
            detalhe: "prompts/visual-base.json não encontrado",
          });
        }

        for (const [antigo, arquivos] of Object.entries(
          cru.target_company?.per_pillar ?? {},
        )) {
          const pilarSlug = PILAR_ANTIGO_PARA_NOVO[antigo];
          if (!pilarSlug || !pilares.has(pilarSlug)) continue;

          const prompt = arquivos.find((f) => f.startsWith("prompts/post-"));
          if (!prompt) continue;

          const texto = await readFile(
            path.join(vaultDir, prompt),
            "utf8",
          ).catch(() => null);
          if (!texto) {
            avisos.push({
              onde: pilarSlug,
              detalhe: `template ausente: ${prompt}`,
            });
            continue;
          }
          await tx
            .update(schema.pilar)
            .set({ template: JSON.parse(texto) })
            .where(
              and(
                eq(schema.pilar.ambienteId, ambienteId),
                eq(schema.pilar.slug, pilarSlug),
              ),
            );
          templates++;
        }
      }

      // ── bancos de temas dos demais pilares ───────────────────────────────
      // O documento do vault traz só o do pilar de decisão; os outros cinco
      // vêm dos arquivos. O código é atribuído aqui e nunca recalculado — é o
      // que impede as citações antigas de apontarem para o tema errado.
      let temasImportados = 0;

      if (vaultDir) {
        const { readFile } = await import("node:fs/promises");
        const path = await import("node:path");

        for (const [antigo, arquivos] of Object.entries(
          cru.target_company?.per_pillar ?? {},
        )) {
          const pilarSlug = PILAR_ANTIGO_PARA_NOVO[antigo];
          if (!pilarSlug || !pilares.has(pilarSlug)) continue;

          const banco = arquivos.find((f) => f.includes("content-bank/"));
          if (!banco) continue;

          const texto = await readFile(
            path.join(vaultDir, banco),
            "utf8",
          ).catch(() => null);
          if (!texto) {
            avisos.push({
              onde: pilarSlug,
              detalhe: `banco de temas ausente: ${banco}`,
            });
            continue;
          }

          let categoria = "";
          for (const linha of texto.split("\n")) {
            const cab = /^### (Categoria [A-F]:.*)$/.exec(linha.trim());
            if (cab) {
              categoria = cab[1];
              continue;
            }
            const item = /^(\d+)\.\s+\*\*(.+?)\*\*(?:\s+—\s+(.*))?$/.exec(
              linha.trim(),
            );
            if (!item || !categoria) continue;

            const letra = categoria.match(/Categoria ([A-F])/)?.[1] ?? "A";
            const codigo = `${letra}${item[1]}`;

            await tx
              .insert(schema.tema)
              .values({
                ambienteId,
                pilarSlug,
                codigo,
                categoria,
                titulo: item[2].trim(),
                angulo: item[3]?.trim() ?? null,
              })
              .onConflictDoNothing();
            temasImportados++;
          }
        }
      }

      // ── escopos de busca e fontes ────────────────────────────────────────
      // O pilar vem do vocabulário do vault; a lista de domínios é entrada
      // manual. A chave estrangeira impede escopo apontando para pilar
      // inexistente — hoje, no YAML, é string digitada.
      const manifest = await store.manifest();
      let escopos = 0;
      let fontes = 0;

      for (const [slug, escopo] of Object.entries(manifest.search_scopes)) {
        await tx
          .insert(schema.escopoBusca)
          .values({ ambienteId, slug, label: escopo.label })
          .onConflictDoUpdate({
            target: [schema.escopoBusca.ambienteId, schema.escopoBusca.slug],
            set: { label: escopo.label },
          });
        escopos++;

        for (const pilarAntigo of escopo.pillars_alvo ?? []) {
          const pilarSlug = PILAR_ANTIGO_PARA_NOVO[pilarAntigo];
          if (!pilarSlug || !pilares.has(pilarSlug)) {
            avisos.push({
              onde: `escopo ${slug}`,
              detalhe: `pilar_alvo sem correspondência no vault: ${pilarAntigo}`,
            });
            continue;
          }
          await tx
            .insert(schema.escopoPilar)
            .values({ ambienteId, escopoSlug: slug, pilarSlug })
            .onConflictDoNothing();
        }

        for (const fonte of escopo.sources) {
          await tx
            .insert(schema.fonte)
            .values({ ambienteId, escopoSlug: slug, slug: fonte, url: fonte })
            .onConflictDoNothing();
          fontes++;
        }
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
        escopos,
        fontes,
        templates,
        temasImportados,
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
