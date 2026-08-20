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

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { comAmbiente, type Tx } from "./cliente";
import * as t from "./schema";
import {
  loadManifest,
  MANIFEST_PATH,
  RADAR_ROOT,
  resolvePaths,
  type BriefState,
} from "../lib/manifest";
import type { Brief, HeroCandidate, StateListing } from "../lib/store/briefs";
import type { LedgerEvent, LedgerReadResult } from "../lib/store/ledger";
import type { TransitionPlan, TransitionResult } from "../lib/transitions/mv";
import { TransitionError } from "../lib/transitions/mv";
import type {
  AmbienteId,
  EdicaoBrief,
  Estagio,
  RadarStore,
  ScanEmAndamento,
  TransicaoEntrada,
} from "../lib/store";
import { JaRodando, StoreError } from "../lib/store";
import type { Enviador } from "../lib/midia/cloudinary";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type LinhaBrief = typeof t.brief.$inferSelect;
type LinhaCandidata = typeof t.briefCandidata.$inferSelect;

/**
 * Quando cada brief foi aprovado. Não é coluna: a aprovação é um evento, e
 * duplicá-la numa coluna criaria duas versões do mesmo fato.
 *
 * Precisa existir porque o diálogo de publicação recusa data anterior à
 * aprovação — sem isto a validação não falha, ela simplesmente não acontece.
 */
async function aprovacoes(
  tx: Tx,
  briefIds: string[],
): Promise<Map<string, string>> {
  if (briefIds.length === 0) return new Map();
  const linhas = await tx
    .select({ briefId: t.evento.briefId, em: t.evento.ts })
    .from(t.evento)
    .where(
      and(
        eq(t.evento.paraEstado, "pendente-publicacao"),
        inArray(t.evento.briefId, briefIds),
      ),
    )
    .orderBy(desc(t.evento.ts));

  const mapa = new Map<string, string>();
  // Ordenado do mais recente para o mais antigo, e só a primeira ocorrência
  // conta: um brief devolvido e reaprovado tem a aprovação que vale sendo a
  // última.
  for (const l of linhas) {
    if (l.briefId && !mapa.has(l.briefId))
      mapa.set(l.briefId, l.em.toISOString());
  }
  return mapa;
}

/**
 * Onde o cache local guarda a mídia deste ambiente.
 *
 * Fora do `store/`, que é a fotografia congelada da importação, e **debaixo do
 * prefixo do ambiente**. Antes era um diretório só para todos: dois clientes
 * com arquivo de mesmo nome se sobrescreviam, e o nome é adivinhável porque sai
 * do `brief_ref`, que cada ambiente numera do 1.
 */
function caminhoDaMidia(prefixo: string, estado: string, arquivo: string) {
  return path.join(RADAR_ROOT, "var", prefixo, estado, path.basename(arquivo));
}

/**
 * O caminho antigo, compartilhado. Só para **leitura**: a mídia dos briefs
 * importados está lá, e mover arquivo do diretório congelado seria mexer no que
 * o relatório de reconciliação compara. Nada novo é escrito aqui.
 */
async function caminhoLegado(estado: string, arquivo: string) {
  const p = resolvePaths(await loadManifest());
  return path.join(p.mediaDir[estado as BriefState], path.basename(arquivo));
}

async function lerArquivo(
  caminho: string,
): Promise<Uint8Array<ArrayBuffer> | null> {
  try {
    return Uint8Array.from(await readFile(caminho));
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw erro;
  }
}

/**
 * A direção de arte, do jsonb para o vocabulário do app.
 *
 * O banco guarda as chaves como o pipeline as escreve — `must_have`,
 * `avoid_visual` — e o app fala `mustHave`, `avoidVisual`. Aqui havia um cast
 * cru: os tipos batiam para o compilador e a tela recebia chaves que não sabia
 * ler, então mostrava direção de arte vazia com o dado inteiro no banco.
 * Cast não converte nada; só cala o compilador.
 */
function paraVisualBrief(valor: unknown): Brief["visualBrief"] {
  const v = (valor ?? {}) as Record<string, unknown>;
  const texto = (x: unknown) => (typeof x === "string" ? x : undefined);
  const lista = (x: unknown) =>
    Array.isArray(x) ? x.filter((i): i is string => typeof i === "string") : [];

  return {
    baseTemplate: texto(v.base_template) ?? texto(v.baseTemplate),
    compositionNotes: texto(v.composition_notes) ?? texto(v.compositionNotes),
    mustHave: lista(v.must_have ?? v.mustHave),
    avoidVisual: lista(v.avoid_visual ?? v.avoidVisual),
    aspectRatio: texto(v.aspect_ratio) ?? texto(v.aspectRatio),
  };
}

/** O app fala o vocabulário do tipo `Brief`; o banco, o das colunas. */
function paraBrief(
  linha: LinhaBrief,
  candidatas: LinhaCandidata[],
  aprovadoEm?: string,
): Brief {
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
    visualBrief: paraVisualBrief(linha.visualBrief),
    relevanceHints: (linha.evidencias ?? []) as Brief["relevanceHints"],
    origin: str(origem.origin),
    approvedAt: aprovadoEm,
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

  const aprovado = await aprovacoes(
    tx,
    linhas.map((l) => l.id),
  );

  return {
    state: estado,
    briefs: linhas.map((l) =>
      paraBrief(l, porBrief.get(l.id) ?? [], aprovado.get(l.id)),
    ),
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

/**
 * Traduz o caminho que a tela usa (o do manifest.yaml) para o grupo da tabela
 * `config`. Caminho desconhecido é recusado em vez de ignorado: gravar metade
 * da edição é pior que não gravar.
 */
function grupoDe(
  caminho: (string | number)[],
): { grupo: "pesos" | "caps" | "janelas" | "volume"; chave: string } | null {
  const [raiz, meio, folha] = caminho.map(String);
  if (raiz === "funnel") return { grupo: "volume", chave: meio };
  if (raiz !== "anti_repetition") return null;
  if (meio === "match_score_weights") return { grupo: "pesos", chave: folha };
  if (meio === "match_score_caps") return { grupo: "caps", chave: folha };
  if (meio === "windows") return { grupo: "janelas", chave: folha };
  return { grupo: "caps", chave: meio };
}

const PROXIMO_ESTADO = {
  approve: "pendente-publicacao",
  reject: "rejeitado",
} as const;

/**
 * @param enviarParaNuvem substituível para que o teste não toque na rede. Em
 * produção sai de `enviador(credenciais(...))`; sem credencial, é `null` e a
 * escolha da arte segue funcionando sem URL remota.
 */
export function backendPostgres(
  ambiente: AmbienteId,
  opcoes: { enviarParaNuvem?: Enviador | null } = {},
): RadarStore {
  const dentro = <T>(trabalho: (tx: Tx) => Promise<T>) =>
    comAmbiente(ambiente, trabalho);

  /** O prefixo de mídia deste ambiente, que separa o cache no disco. */
  async function prefixoDoAmbiente(tx: Tx): Promise<string> {
    const [linha] = await tx
      .select({ prefixo: t.ambiente.prefixoMidia })
      .from(t.ambiente)
      .where(eq(t.ambiente.id, ambiente));
    return linha?.prefixo ?? `midia/${ambiente}`;
  }

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
        const aprovado = await aprovacoes(tx, [linha.id]);
        return paraBrief(linha, candidatas, aprovado.get(linha.id));
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

        if (indice === null) return;

        /**
         * A foto escolhida sobe agora. É o instante em que ela deixa de ser
         * cache local e vira artefato externo: depois disto o export só precisa
         * citar a URL, e aprovar já apaga as candidatas que ficaram para trás.
         *
         * Falha de upload **não desfaz a escolha**. A decisão é da pessoa e já
         * é válida; o que fica pendente é a cópia remota, e o export diz na
         * cara quando ela falta. Derrubar a transação aqui faria uma
         * indisponibilidade do Cloudinary bloquear a revisão da fila.
         */
        const enviar = opcoes.enviarParaNuvem;
        if (!enviar) return;

        const [candidata] = await tx
          .select()
          .from(t.briefCandidata)
          .where(
            and(
              eq(t.briefCandidata.briefId, linha.id),
              eq(t.briefCandidata.indice, indice),
            ),
          );
        if (!candidata?.objetoPath) return;

        const prefixo = await prefixoDoAmbiente(tx);
        // A candidata já foi verificada como deste ambiente logo acima, então
        // o legado pode ser lido sem nova checagem — é a foto de um brief
        // importado, cujo arquivo nunca migrou do diretório antigo.
        const bytes =
          (await lerArquivo(
            caminhoDaMidia(prefixo, linha.estado, candidata.objetoPath),
          )) ??
          (await lerArquivo(
            await caminhoLegado(linha.estado, candidata.objetoPath),
          ));
        if (!bytes) return;

        try {
          // Prefixo do ambiente no caminho: é o que impede a mídia de dois
          // clientes de colidir numa pasta só, como acontece no cache local.
          const enviado = await enviar({
            bytes,
            publicId: `${prefixo}/${linha.slug}`,
            nomeArquivo: candidata.objetoPath,
          });

          await tx
            .update(t.briefCandidata)
            .set({
              cloudUrl: enviado.url,
              cloudinaryPublicId: enviado.publicId,
            })
            .where(
              and(
                eq(t.briefCandidata.briefId, linha.id),
                eq(t.briefCandidata.indice, indice),
              ),
            );

          await tx.insert(t.evento).values({
            ambienteId: ambiente,
            tipo: "cloudinary-uploaded",
            ator: "app:radar-web",
            briefId: linha.id,
            extra: { indice, public_id: enviado.publicId },
          });
        } catch (erro) {
          await tx.insert(t.evento).values({
            ambienteId: ambiente,
            tipo: "cloudinary-falhou",
            ator: "app:radar-web",
            briefId: linha.id,
            extra: { indice, erro: (erro as Error).message },
          });
        }
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

    listarBlocos: () =>
      dentro(async (tx) => {
        const linhas = await tx
          .select()
          .from(t.vaultBloco)
          .orderBy(t.vaultBloco.ordem);
        return linhas.map((l) => ({
          slug: l.slug,
          titulo: l.titulo,
          corpo: l.corpo,
          ordem: l.ordem,
          escopo: l.escopo,
          contrato: l.contrato,
          versao: l.versao,
          atualizadoEm: l.atualizadoEm.toISOString(),
        }));
      }),

    /**
     * Bloco e versão numa transação só: a versão nova e o histórico dela nascem
     * juntos ou não nascem. Se o registro do porquê pudesse falhar sozinho, o
     * histórico teria buracos justamente onde alguém foi olhar.
     */
    gravarBloco: (slug, corpo, motivo) =>
      dentro(async (tx) => {
        const [atual] = await tx
          .select()
          .from(t.vaultBloco)
          .where(eq(t.vaultBloco.slug, slug));
        if (!atual)
          throw new StoreError("nao_encontrado", `bloco não existe: ${slug}`);

        // Bloco vazio virando conteúdo é a versão 1 — o provisionamento cria a
        // linha, mas não é uma versão: ninguém respondeu nada ainda.
        const versao = atual.corpo === "" ? 1 : atual.versao + 1;

        await tx
          .update(t.vaultBloco)
          .set({ corpo, versao, atualizadoEm: new Date() })
          .where(eq(t.vaultBloco.slug, slug));

        await tx.insert(t.vaultBlocoVersao).values({
          ambienteId: ambiente,
          slug,
          versao,
          corpo,
          motivo,
        });
      }),

    configuracao: () =>
      dentro(async (tx) => {
        const [linha] = await tx.select().from(t.config);
        if (!linha)
          throw new StoreError("nao_encontrado", "ambiente sem configuração");
        return {
          pesos: linha.pesos as Record<string, number>,
          caps: linha.caps as Record<string, number>,
          janelas: linha.janelas as Record<string, number | string>,
          volume: linha.volume as Record<string, number | string>,
        };
      }),

    contato: () =>
      dentro(async (tx) => {
        const [linha] = await tx.select().from(t.marca);
        return linha
          ? {
              canalPrincipal: linha.canalPrincipal,
              telefoneExibicao: linha.telefoneExibicao,
              telefoneE164: linha.telefoneE164,
              telefoneSecundarioE164: linha.telefoneSecundarioE164,
            }
          : null;
      }),

    gravarContato: (dados) =>
      dentro(async (tx) => {
        await tx
          .insert(t.marca)
          .values({ ambienteId: ambiente, ...dados })
          .onConflictDoUpdate({
            target: t.marca.ambienteId,
            set: { ...dados, atualizadoEm: new Date() },
          });
      }),

    escoposDeBusca: () =>
      dentro(async (tx) => {
        const [escopos, fontes, pilares] = await Promise.all([
          tx.select().from(t.escopoBusca).orderBy(t.escopoBusca.slug),
          tx.select().from(t.fonte),
          tx.select().from(t.escopoPilar),
        ]);
        return escopos.map((e) => ({
          slug: e.slug,
          label: e.label,
          ativo: e.ativo,
          fontes: fontes
            .filter((f) => f.escopoSlug === e.slug)
            .map((f) => ({
              slug: f.slug,
              url: f.url,
              nota: f.nota,
              ativo: f.ativo,
            })),
          pilares: pilares
            .filter((p) => p.escopoSlug === e.slug)
            .map((p) => p.pilarSlug),
        }));
      }),

    /**
     * O banco é a fonte da verdade. O manifest.yaml recebe a mesma mudança por
     * recorte cirúrgico porque as skills ainda o leem — é projeção de uma
     * fonte só, não segunda fonte, e some quando a injeção entrar (fase 4).
     *
     * A ordem importa: se o arquivo falhar, a transação do banco não commitou
     * e os dois seguem iguais. O contrário deixaria o banco à frente em
     * silêncio.
     *
     * **A projeção é de um ambiente só.** Existe um `manifest.yaml`, e ele
     * pertence à empresa declarada em `target_company.slug`. Sem esta
     * verificação, um ambiente reescreveria a configuração das skills de
     * outro — o vazamento que o RLS impede no banco, entrando pela porta do
     * arquivo.
     */
    gravarConfiguracao: (edicoes) =>
      dentro(async (tx) => {
        const [linha] = await tx.select().from(t.config);
        if (!linha)
          throw new StoreError("nao_encontrado", "ambiente sem configuração");

        const atual = {
          pesos: linha.pesos as Record<string, unknown>,
          caps: linha.caps as Record<string, unknown>,
          janelas: linha.janelas as Record<string, unknown>,
          volume: linha.volume as Record<string, unknown>,
        };

        for (const { path: caminho, value } of edicoes) {
          const grupo = grupoDe(caminho);
          if (!grupo)
            throw new StoreError(
              "candidata_invalida",
              `caminho fora da configuração: ${caminho.join(".")}`,
            );
          atual[grupo.grupo][grupo.chave] = value;
        }

        await tx.update(t.config).set({ ...atual, atualizadoEm: new Date() });

        const [amb] = await tx
          .select()
          .from(t.ambiente)
          .where(eq(t.ambiente.id, ambiente));
        const manifest = await loadManifest();
        const dono = (manifest as { target_company?: { slug?: string } })
          .target_company?.slug;

        if (amb && dono === amb.slug) {
          const { patchManifest } = await import("../lib/config/manifest-edit");
          const bruto = await readFile(MANIFEST_PATH, "utf8");
          await writeFile(MANIFEST_PATH, patchManifest(bruto, edicoes), "utf8");
        }
      }),

    estadoDaConfig: () =>
      dentro(async (tx) => {
        const [fontes] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(t.fonte);
        const [ajustes] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(t.config);
        const [contato] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(t.marca);
        return {
          temFontes: fontes.n > 0,
          temAjustes: ajustes.n > 0,
          temContato: contato.n > 0,
        };
      }),

    /**
     * Publicar acontece fora do produto: a pessoa posta no Instagram e volta
     * com a URL. O app registra que aconteceu — a URL é a prova, e é ela que
     * torna o evento auditável depois.
     */
    marcarPublicado: (slug, dados) =>
      dentro(async (tx) => {
        const linha = await buscarLinha(tx, slug);
        if (linha.estado !== "pendente-publicacao") {
          throw new StoreError(
            "nao_encontrado",
            `brief está em ${linha.estado}; só se publica o que foi aprovado`,
          );
        }

        await tx
          .update(t.brief)
          .set({
            estado: "publicado",
            publicadoEm: dados.publicadoEm,
            igPostUrl: dados.igPostUrl,
            atualizadoEm: new Date(),
          })
          .where(eq(t.brief.id, linha.id));

        await tx.insert(t.evento).values({
          ambienteId: ambiente,
          tipo: "published",
          ator: "app:radar-web",
          briefId: linha.id,
          deEstado: "pendente-publicacao",
          paraEstado: "publicado",
          extra: {
            ig_post_url: dados.igPostUrl,
            published_at: dados.publicadoEm.toISOString(),
          },
        });
      }),

    /**
     * O package num `.md` só. A hero entra como URL do Cloudinary quando
     * existe: depois do upload ela não é mais arquivo, e copiar a foto para
     * dentro do pacote seria redundância do desenho antigo.
     */
    exportar: (slug) =>
      dentro(async (tx) => {
        const linha = await buscarLinha(tx, slug);
        const candidatas = await tx
          .select()
          .from(t.briefCandidata)
          .where(eq(t.briefCandidata.briefId, linha.id));
        const [marca] = await tx.select().from(t.marca);
        const [pilar] = await tx
          .select()
          .from(t.pilar)
          .where(eq(t.pilar.slug, linha.pilarSlug));

        const hero = candidatas.find((c) => c.indice === linha.heroIndice);
        const destino = (linha.destinoOd ?? {}) as Record<string, unknown>;
        const visual = (linha.visualBrief ?? {}) as Record<string, unknown>;
        const lista = (v: unknown) =>
          Array.isArray(v) && v.length > 0
            ? v.map((x) => `- ${x}`).join("\n")
            : "_(nada declarado)_";

        const conteudo = `# ${linha.headline}

> Package do content-radar para o Smart Design.
> Brief \`${linha.briefId}\` · pilar \`${linha.pilarSlug}\` · público \`${linha.publicoSlug}\`

## A arte

- **Skill sugerida:** \`${destino.od_skill_ref ?? "—"}\`
- **Alternativas:** ${Array.isArray(destino.alternativas) && destino.alternativas.length ? (destino.alternativas as string[]).map((a) => `\`${a}\``).join(", ") : "—"}
- **Hero:** ${
          linha.heroDecididoEm === null
            ? "**não decidida** — este brief não deveria ter chegado aqui"
            : hero?.cloudUrl
              ? hero.cloudUrl
              : linha.heroIndice === null
                ? "**sem foto** — o Smart Design gera a arte"
                : "**escolhida, mas ainda sem URL do Cloudinary**"
        }

### Precisa ter

${lista(visual.mustHave ?? visual.must_have)}

### Evitar

${lista(visual.avoidVisual ?? visual.avoid_visual)}

${visual.compositionNotes || visual.composition_notes ? `### Composição\n\n${visual.compositionNotes ?? visual.composition_notes}\n` : ""}
## A copy

**Hook:** ${linha.hook ?? "—"}

${linha.captionDraft ?? "_(sem rascunho de legenda)_"}

**CTA:** ${linha.cta ?? "—"}
${marca?.telefoneExibicao ? `**Telefone na arte:** ${marca.telefoneExibicao} · ${marca.canalPrincipal}\n` : ""}
${linha.hashtags?.length ? `**Hashtags:** ${linha.hashtags.map((h) => `#${h}`).join(" ")}\n` : ""}
## Por que esta pauta

${pilar ? `**${pilar.nome}** — ${pilar.corpo.split("\n")[0]}\n\n` : ""}${((linha.origem ?? {}) as Record<string, unknown>).why_match ?? "_(sem justificativa registrada)_"}

---

_Gerado em ${new Date().toISOString()} · não publica no Instagram: a publicação é manual._
`;

        await tx
          .update(t.brief)
          .set({ handoffEm: new Date() })
          .where(eq(t.brief.id, linha.id));

        await tx.insert(t.evento).values({
          ambienteId: ambiente,
          tipo: "handoff-finished",
          ator: "app:radar-web",
          briefId: linha.id,
          extra: {
            hero_choice: linha.heroIndice,
            cloudinary: hero?.cloudUrl ? "url" : "skipped",
          },
        });

        return { nome: `${linha.slug}.md`, conteudo };
      }),

    /**
     * Pede uma varredura. O índice único cobre `rodando`; os demais estados em
     * andamento precisam da checagem explícita, senão a pessoa acumula pedidos
     * que só vai descobrir quando dois scans iguais gerarem pauta repetida.
     */
    enfileirarScan: (pedido) =>
      dentro(async (tx) => {
        const emAndamento = await tx
          .select({ id: t.scan.id })
          .from(t.scan)
          .where(
            sql`${t.scan.estado} in ('enfileirado','rodando','pesquisa','filtragem','redacao')`,
          );
        if (emAndamento.length > 0) throw new JaRodando();

        const todos = await tx.select({ id: t.scan.id }).from(t.scan);
        const agora = new Date();
        const ano = agora.getUTCFullYear();
        const semana = Math.ceil(
          ((agora.getTime() - Date.UTC(ano, 0, 1)) / 86400000 + 1) / 7,
        );
        const ref = `${ano}-W${String(semana).padStart(2, "0")}-scan-${String(
          todos.length + 1,
        ).padStart(3, "0")}`;

        const [linha] = await tx
          .insert(t.scan)
          .values({
            ambienteId: ambiente,
            scanRef: ref,
            escopo: pedido.escopo,
            pilarFiltro: pedido.pilar ?? null,
            alvoQtd: pedido.alvo ?? null,
            estado: "enfileirado",
          })
          .returning({ id: t.scan.id });

        // A entrada da fila carrega só identificadores — é o que permite
        // escolher o próximo sem enxergar conteúdo de ninguém.
        await tx.insert(t.filaPedido).values({
          scanId: linha.id,
          ambienteId: ambiente,
        });

        await tx.insert(t.evento).values({
          ambienteId: ambiente,
          tipo: "scan-enfileirado",
          ator: "app:radar-web",
          scanId: linha.id,
          extra: { ...pedido },
        });

        const [{ n }] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(t.filaPedido)
          .where(sql`${t.filaPedido.reivindicadoEm} is null`);

        return { scanId: linha.id, scanRef: ref, posicao: n };
      }),

    vocabulario: () =>
      dentro(async (tx) => {
        const [pilares, publicos] = await Promise.all([
          tx.select().from(t.pilar).orderBy(t.pilar.ordem),
          tx.select().from(t.publico).orderBy(t.publico.slug),
        ]);
        return {
          pilares: pilares.map((p) => ({
            slug: p.slug,
            nome: p.nome,
            corpo: p.corpo,
            ordem: p.ordem,
            noRadar: p.noRadar,
          })),
          publicos: publicos.map((p) => ({
            slug: p.slug,
            nome: p.nome,
            corpo: p.corpo,
            padrao: p.padrao,
          })),
        };
      }),

    scanEmAndamento: () =>
      dentro(async (tx): Promise<ScanEmAndamento | null> => {
        const [linha] = await tx
          .select()
          .from(t.scan)
          .where(
            sql`${t.scan.estado} in ('enfileirado','rodando','pesquisa','filtragem','redacao')`,
          )
          .orderBy(desc(t.scan.pedidoEm))
          .limit(1);
        if (!linha) return null;

        const eventos = await tx
          .select({ extra: t.evento.extra })
          .from(t.evento)
          .where(
            and(eq(t.evento.scanId, linha.id), eq(t.evento.tipo, "scan-stage")),
          )
          .orderBy(t.evento.ts);

        /**
         * A posição só vale enquanto o pedido espera vaga: depois de
         * reivindicado, "3º da fila" seria mentira. Conta como dono? Não —
         * `fila_pedido` não tem RLS, então a contagem enxerga a fila inteira,
         * que é justamente o que dá sentido à posição.
         */
        let posicao: number | null = null;
        if (linha.estado === "enfileirado") {
          const [{ n }] = await tx
            .select({ n: sql<number>`count(*)::int` })
            .from(t.filaPedido)
            .where(
              sql`${t.filaPedido.reivindicadoEm} is null
                  and ${t.filaPedido.criadoEm} <= (
                    select criado_em from fila_pedido where scan_id = ${linha.id}
                  )`,
            );
          posicao = n;
        }

        return {
          scanId: linha.id,
          scanRef: linha.scanRef,
          estado: linha.estado as ScanEmAndamento["estado"],
          pedido: {
            escopo: linha.escopo,
            pilar: linha.pilarFiltro ?? undefined,
            alvo: linha.alvoQtd ?? undefined,
          },
          pedidoEm: linha.pedidoEm.toISOString(),
          iniciadoEm: linha.iniciadoEm?.toISOString() ?? null,
          posicao,
          estagios: eventos.map((e) => {
            const extra = (e.extra ?? {}) as Record<string, unknown>;
            const { estagio, minuto, ...resto } = extra;
            return {
              estagio: estagio as Estagio,
              minuto: typeof minuto === "number" ? minuto : 0,
              extra: resto,
            };
          }),
        };
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
    /**
     * Lê uma mídia **deste** ambiente.
     *
     * A dona é a consulta, não o caminho: só entrega bytes se existir uma
     * candidata com este arquivo num brief que o RLS deixa enxergar. Sem isso o
     * caminho seria a única defesa, e caminho se adivinha — era assim que um
     * cliente lia a foto de outro sabendo o nome do arquivo.
     */
    lerMidia: (estado, arquivo) =>
      dentro(async (tx) => {
        const [dona] = await tx
          .select({ id: t.briefCandidata.briefId })
          .from(t.briefCandidata)
          .innerJoin(
            t.brief,
            and(
              eq(t.brief.id, t.briefCandidata.briefId),
              eq(t.brief.estado, estado),
            ),
          )
          .where(eq(t.briefCandidata.objetoPath, path.basename(arquivo)));
        if (!dona) return null;

        const prefixo = await prefixoDoAmbiente(tx);
        return (
          (await lerArquivo(caminhoDaMidia(prefixo, estado, arquivo))) ??
          // Os briefs importados têm a foto no diretório antigo. A consulta
          // acima já provou que este arquivo é deste ambiente.
          (await lerArquivo(await caminhoLegado(estado, arquivo)))
        );
      }),

    caminhoMidia: (estado, arquivo) =>
      dentro(async (tx) =>
        caminhoDaMidia(await prefixoDoAmbiente(tx), estado, arquivo),
      ),
  };
}
