/**
 * Esquema do content-radar — desenho em docs/design-esquema-banco.md.
 *
 * Duas coisas sustentam o isolamento entre clientes, e nenhuma delas é
 * disciplina de quem escreve consulta:
 *
 * 1. `politicaAmbiente()` em toda tabela com `ambiente_id` — o banco não
 *    entrega linha de outro ambiente nem aceita gravar nele. O `FORCE ROW
 *    LEVEL SECURITY`, que faz a política valer até para o dono da tabela, vive
 *    numa migração à parte porque o Drizzle não o expressa.
 *
 * 2. Chave estrangeira **composta**, sempre com `ambiente_id` junto. Sem isso
 *    um brief poderia apontar para o pilar de outro cliente e o banco aceitaria.
 */

import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  foreignKey,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/** O ambiente da sessão, definido por `SET LOCAL app.ambiente` na transação. */
const ambienteDaSessao = sql`current_setting('app.ambiente', true)::uuid`;

/**
 * `USING` filtra a leitura; `WITH CHECK` impede gravar linha de outro ambiente.
 * Sem o segundo dá para ler certo e escrever errado.
 */
function politicaAmbiente(coluna: unknown) {
  return pgPolicy("isolamento", {
    for: "all",
    using: sql`${coluna} = ${ambienteDaSessao}`,
    withCheck: sql`${coluna} = ${ambienteDaSessao}`,
  });
}

export const briefEstado = pgEnum("brief_estado", [
  "pendente-aprovacao",
  "pendente-publicacao",
  "publicado",
  "rejeitado",
]);

/* ── ambiente e acesso ─────────────────────────────────────────────────────
 * Sem RLS: são as tabelas consultadas ANTES de haver ambiente definido, no
 * login. O acesso a elas se restringe por privilégio.
 */

export const ambiente = pgTable("ambiente", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  nome: text("nome").notNull(),
  prefixoMidia: text("prefixo_midia").notNull(),
  criadoEm: timestamp("criado_em", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const usuario = pgTable(
  "usuario",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    senhaHash: text("senha_hash").notNull(),
    ambienteId: uuid("ambiente_id")
      .notNull()
      .references(() => ambiente.id, { onDelete: "cascade" }),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("usuario_ambiente_id_uk").on(t.ambienteId, t.id)],
);

/* ── vault ─────────────────────────────────────────────────────────────────
 * Sequência ordenada de blocos, todos com corpo em prosa. Identidade estável
 * só onde algo de fora aponta: pilares, públicos, temas, guardrails.
 */

export const vaultBloco = pgTable(
  "vault_bloco",
  {
    ambienteId: uuid("ambiente_id")
      .notNull()
      .references(() => ambiente.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    titulo: text("titulo").notNull(),
    corpo: text("corpo").notNull(),
    ordem: smallint("ordem").notNull(),
    escopo: text("escopo").notNull(), // sempre | por-pilar
    contrato: text("contrato").notNull(), // obrigatorio | degrada | opcional
    versao: bigint("versao", { mode: "number" }).notNull().default(1),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.ambienteId, t.slug] }),
    politicaAmbiente(t.ambienteId),
  ],
);

/** `motivo` é NOT NULL de propósito: prosa não tem validação automática, então
 *  o histórico é a única rede de segurança — e sem o porquê ele responde
 *  metade da pergunta. */
export const vaultBlocoVersao = pgTable(
  "vault_bloco_versao",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ambienteId: uuid("ambiente_id").notNull(),
    slug: text("slug").notNull(),
    versao: bigint("versao", { mode: "number" }).notNull(),
    corpo: text("corpo").notNull(),
    motivo: text("motivo").notNull(),
    autorId: uuid("autor_id").references(() => usuario.id),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("vault_bloco_versao_uk").on(t.ambienteId, t.slug, t.versao),
    foreignKey({
      columns: [t.ambienteId, t.slug],
      foreignColumns: [vaultBloco.ambienteId, vaultBloco.slug],
    }).onDelete("cascade"),
    politicaAmbiente(t.ambienteId),
  ],
);

/** Slug atribuído na criação e imutável. `nome` é exibição e muda à vontade;
 *  `ordem` é apresentação. Nenhuma rotina recalcula o slug a partir da ordem —
 *  é o que mata a quebra silenciosa da referência da configuração. */
export const pilar = pgTable(
  "pilar",
  {
    ambienteId: uuid("ambiente_id")
      .notNull()
      .references(() => ambiente.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    nome: text("nome").notNull(),
    corpo: text("corpo").notNull(),
    ordem: smallint("ordem").notNull(),
    noRadar: boolean("no_radar").notNull().default(true),
    /**
     * Template de geração deste pilar — o que era `prompts/post-*.json` no
     * vault de arquivos. Carrega identidade visual, tratamento de foto e
     * elementos fixos, então é do cliente, não do produto.
     */
    template: jsonb("template"),
  },
  (t) => [
    primaryKey({ columns: [t.ambienteId, t.slug] }),
    politicaAmbiente(t.ambienteId),
  ],
);

export const publico = pgTable(
  "publico",
  {
    ambienteId: uuid("ambiente_id")
      .notNull()
      .references(() => ambiente.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    nome: text("nome").notNull(),
    corpo: text("corpo").notNull(),
    padrao: boolean("padrao").notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.ambienteId, t.slug] }),
    politicaAmbiente(t.ambienteId),
  ],
);

/** `codigo` (`B10`) atribuído na criação e imutável: os briefs citam o tema por
 *  ele na justificativa do score. Renumerar faria as citações antigas
 *  apontarem para o tema errado, sem erro nenhum. */
export const tema = pgTable(
  "tema",
  {
    ambienteId: uuid("ambiente_id").notNull(),
    pilarSlug: text("pilar_slug").notNull(),
    codigo: text("codigo").notNull(),
    categoria: text("categoria").notNull(),
    titulo: text("titulo").notNull(),
    angulo: text("angulo"),
    esgotadoEm: timestamp("esgotado_em", { withTimezone: true }),
    usadoEm: timestamp("usado_em", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.ambienteId, t.pilarSlug, t.codigo] }),
    foreignKey({
      columns: [t.ambienteId, t.pilarSlug],
      foreignColumns: [pilar.ambienteId, pilar.slug],
    }).onDelete("cascade"),
    politicaAmbiente(t.ambienteId),
  ],
);

export const guardrail = pgTable(
  "guardrail",
  {
    ambienteId: uuid("ambiente_id")
      .notNull()
      .references(() => ambiente.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    corpo: text("corpo").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.ambienteId, t.slug] }),
    politicaAmbiente(t.ambienteId),
  ],
);

/**
 * A fila de execução — **sem RLS, de propósito**.
 *
 * Escolher o próximo scan é a única operação do sistema que atravessa
 * ambientes: a vaga global é do servidor. Com RLS, quem reivindica precisaria
 * de exceção para enxergar todos — e exceção no isolamento é o que a gente
 * passou o projeto inteiro evitando.
 *
 * A saída é a fila não guardar conteúdo. Só id, ambiente e momento: quem lê
 * não vê brief, vault nem configuração de ninguém. Mesmo princípio de
 * `ambiente` e `usuario`, que também não têm RLS porque são consultados antes
 * de haver ambiente.
 */
export const filaPedido = pgTable("fila_pedido", {
  scanId: uuid("scan_id").primaryKey(),
  ambienteId: uuid("ambiente_id")
    .notNull()
    .references(() => ambiente.id, { onDelete: "cascade" }),
  criadoEm: timestamp("criado_em", { withTimezone: true })
    .notNull()
    .defaultNow(),
  /**
   * Nulo enquanto espera; carimbado quando um trabalhador pega. A linha só sai
   * da tabela quando a execução termina — é o que permite contar os em voo sem
   * perguntar à tabela `scan`, que exigiria enxergar conteúdo de todo ambiente.
   */
  reivindicadoEm: timestamp("reivindicado_em", { withTimezone: true }),
});

/**
 * Fatos estáveis da marca, em campo e não em prosa.
 *
 * O bloco `contato` do vault descreve o canal e o tom do CTA — isso é prosa e o
 * modelo lê. Mas o número que vai no rodapé da arte é **valor**: a skill o
 * injeta no `must_have` do briefing visual e no package. Extrair de prosa por
 * expressão regular seria a fragilidade que a forma de bloco existe para
 * evitar.
 */
export const marca = pgTable(
  "marca",
  {
    ambienteId: uuid("ambiente_id")
      .primaryKey()
      .references(() => ambiente.id, { onDelete: "cascade" }),
    canalPrincipal: text("canal_principal").notNull(),
    telefoneExibicao: text("telefone_exibicao"),
    telefoneE164: text("telefone_e164"),
    telefoneSecundarioE164: text("telefone_secundario_e164"),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [politicaAmbiente(t.ambienteId)],
);

/* ── configuração ──────────────────────────────────────────────────────── */

/** Pesos, caps e janelas ficam em jsonb porque são lidos inteiros na execução e
 *  validados na aplicação. Em colunas, cada componente novo de score viraria
 *  migração. Segredos não entram aqui. */
export const config = pgTable(
  "config",
  {
    ambienteId: uuid("ambiente_id")
      .primaryKey()
      .references(() => ambiente.id, { onDelete: "cascade" }),
    pesos: jsonb("pesos").notNull(),
    caps: jsonb("caps").notNull(),
    janelas: jsonb("janelas").notNull(),
    volume: jsonb("volume").notNull(),
    /** Base visual compartilhada entre os pilares (`prompts/visual-base.json`). */
    visualBase: jsonb("visual_base"),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [politicaAmbiente(t.ambienteId)],
);

export const escopoBusca = pgTable(
  "escopo_busca",
  {
    ambienteId: uuid("ambiente_id")
      .notNull()
      .references(() => ambiente.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    ativo: boolean("ativo").notNull().default(true),
  },
  (t) => [
    primaryKey({ columns: [t.ambienteId, t.slug] }),
    politicaAmbiente(t.ambienteId),
  ],
);

/** A única ponte entre o vault e a configuração: o pilar vem do vocabulário do
 *  vault, a fonte é entrada manual. A chave estrangeira impede escopo
 *  referenciando pilar inexistente — hoje é string digitada no YAML. */
export const escopoPilar = pgTable(
  "escopo_pilar",
  {
    ambienteId: uuid("ambiente_id").notNull(),
    escopoSlug: text("escopo_slug").notNull(),
    pilarSlug: text("pilar_slug").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.ambienteId, t.escopoSlug, t.pilarSlug] }),
    foreignKey({
      columns: [t.ambienteId, t.escopoSlug],
      foreignColumns: [escopoBusca.ambienteId, escopoBusca.slug],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.ambienteId, t.pilarSlug],
      foreignColumns: [pilar.ambienteId, pilar.slug],
    }),
    politicaAmbiente(t.ambienteId),
  ],
);

export const fonte = pgTable(
  "fonte",
  {
    ambienteId: uuid("ambiente_id").notNull(),
    escopoSlug: text("escopo_slug").notNull(),
    slug: text("slug").notNull(),
    url: text("url").notNull(),
    nota: text("nota"),
    ativo: boolean("ativo").notNull().default(true),
  },
  (t) => [
    primaryKey({ columns: [t.ambienteId, t.escopoSlug, t.slug] }),
    foreignKey({
      columns: [t.ambienteId, t.escopoSlug],
      foreignColumns: [escopoBusca.ambienteId, escopoBusca.slug],
    }).onDelete("cascade"),
    politicaAmbiente(t.ambienteId),
  ],
);

/* ── eixo operacional ──────────────────────────────────────────────────── */

export const scan = pgTable(
  "scan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ambienteId: uuid("ambiente_id")
      .notNull()
      .references(() => ambiente.id, { onDelete: "cascade" }),
    scanRef: text("scan_ref").notNull(),
    escopo: text("escopo").notNull(),
    pilarFiltro: text("pilar_filtro"),
    alvoQtd: smallint("alvo_qtd"),
    /**
     * enfileirado → rodando → pesquisa → filtragem → redacao → concluido,
     * ou falhou. Os estágios ficam aqui porque este é o estado **corrente**,
     * que a tela lê; o histórico deles vive no ledger, como evento
     * (design-execucao-scan §9).
     */
    estado: text("estado").notNull(),
    /** Contra qual estado do vault o scan rodou — é o que torna respondível
     *  "esta pauta ruim saiu de qual versão dos pilares?". */
    vaultVersao: bigint("vault_versao", { mode: "number" }),
    /**
     * Quando foi **pedido** e quando **começou** são momentos diferentes desde
     * que existe fila: entre um e outro cabe a espera por vaga global. Sem os
     * dois, "esperando há 4 minutos" não é calculável, e a duração do scan
     * passaria a incluir o tempo parado.
     */
    pedidoEm: timestamp("pedido_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    iniciadoEm: timestamp("iniciado_em", { withTimezone: true }),
    encerradoEm: timestamp("encerrado_em", { withTimezone: true }),
  },
  (t) => [
    unique("scan_ref_uk").on(t.ambienteId, t.scanRef),
    unique("scan_ambiente_id_uk").on(t.ambienteId, t.id),
    politicaAmbiente(t.ambienteId),
  ],
);

/**
 * Coluna para o que se filtra, ordena ou junta; jsonb para o que só se lê
 * inteiro.
 *
 * `heroIndice` + `heroDecididoEm` desfazem a ambiguidade que hoje existe no
 * arquivo: `hero_choice: null` significa tanto "o briefer gravou o padrão"
 * quanto "o humano decidiu não usar foto". Com o carimbo, aprovar só libera
 * para quem tem decisão registrada — e isso vira condição de consulta, não
 * convenção de tela.
 */
export const brief = pgTable(
  "brief",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ambienteId: uuid("ambiente_id")
      .notNull()
      .references(() => ambiente.id, { onDelete: "cascade" }),

    briefId: text("brief_id").notNull(),
    slug: text("slug").notNull(),
    estado: briefEstado("estado").notNull(),

    pilarSlug: text("pilar_slug").notNull(),
    publicoSlug: text("publico_slug").notNull(),
    matchScore: numeric("match_score", { precision: 3, scale: 2 }),
    borderline: boolean("borderline").notNull().default(false),
    borderlineMotivo: text("borderline_motivo"),

    topicHash: text("topic_hash").notNull(),

    headline: text("headline").notNull(),
    hook: text("hook"),
    captionDraft: text("caption_draft"),
    cta: text("cta"),
    hashtags: text("hashtags").array(),

    scoreDetalhe: jsonb("score_detalhe"),
    evidencias: jsonb("evidencias"),
    origem: jsonb("origem"),
    visualBrief: jsonb("visual_brief"),
    destinoOd: jsonb("destino_od"),

    heroIndice: smallint("hero_indice"),
    heroDecididoEm: timestamp("hero_decidido_em", { withTimezone: true }),
    heroDecididoPor: uuid("hero_decidido_por").references(() => usuario.id),

    scanId: uuid("scan_id"),
    reviewNotes: text("review_notes"),
    /**
     * O que este brief tem de pendente ou duvidoso — sem legenda, sem imagem,
     * campo que veio por apelido.
     *
     * No brief e não no evento do scan: quem decide publicar abre o brief, não
     * a varredura que o produziu. Preso ao evento, o aviso some da vista assim
     * que outra varredura roda, e some do pacote sempre.
     */
    avisos: jsonb("avisos"),

    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    handoffEm: timestamp("handoff_em", { withTimezone: true }),
    publicadoEm: timestamp("publicado_em", { withTimezone: true }),
    igPostUrl: text("ig_post_url"),
  },
  (t) => [
    unique("brief_ref_uk").on(t.ambienteId, t.briefId),
    unique("brief_ambiente_id_uk").on(t.ambienteId, t.id),
    foreignKey({
      columns: [t.ambienteId, t.pilarSlug],
      foreignColumns: [pilar.ambienteId, pilar.slug],
    }),
    foreignKey({
      columns: [t.ambienteId, t.publicoSlug],
      foreignColumns: [publico.ambienteId, publico.slug],
    }),
    foreignKey({
      columns: [t.ambienteId, t.scanId],
      foreignColumns: [scan.ambienteId, scan.id],
    }).onDelete("set null"),
    // A fila e o acervo.
    index("brief_estado_idx").on(t.ambienteId, t.estado, t.criadoEm.desc()),
    // A anti-repetição por hash.
    index("brief_hash_idx").on(t.ambienteId, t.topicHash),
    // A janela de redundância pilar+ICP de 14 dias.
    index("brief_pilar_publico_idx").on(
      t.ambienteId,
      t.pilarSlug,
      t.publicoSlug,
      t.criadoEm.desc(),
    ),
    politicaAmbiente(t.ambienteId),
  ],
);

/** Tabela e não jsonb porque a licença é consultada por item — a fila mostra
 *  "uso referencial" por foto — e porque a purga opera candidata a candidata. */
export const briefCandidata = pgTable(
  "brief_candidata",
  {
    ambienteId: uuid("ambiente_id").notNull(),
    briefId: uuid("brief_id").notNull(),
    indice: smallint("indice").notNull(),
    sourceUrl: text("source_url"),
    imageUrl: text("image_url"),
    objetoPath: text("objeto_path"),
    cloudUrl: text("cloud_url"),
    cloudinaryPublicId: text("cloudinary_public_id"),
    alt: text("alt"),
    licenseHint: text("license_hint"),
    licensable: boolean("licensable"),
    mimeType: text("mime_type"),
  },
  (t) => [
    primaryKey({ columns: [t.briefId, t.indice] }),
    foreignKey({
      columns: [t.ambienteId, t.briefId],
      foreignColumns: [brief.ambienteId, brief.id],
    }).onDelete("cascade"),
    politicaAmbiente(t.ambienteId),
  ],
);

/**
 * Append-only: é a trilha de auditoria, e a única garantia dela é não ser
 * reescrita. `radar_app` não recebe UPDATE nem DELETE nesta tabela — o banco
 * recusa, e a garantia deixa de depender de alguém lembrar.
 *
 * `tipo` é text e não enum porque o conjunto cresce a cada skill nova, e
 * migração de enum por isso é atrito sem ganho.
 */
/**
 * Uma conversa do chat.
 *
 * Vivia na aba do navegador: recarregar perdia o histórico, e o que o agente
 * consultou para responder ia junto. A memória dele já ficava no servidor — a
 * sessão do SDK —, mas o ponteiro para ela morava no cliente, então nem retomar
 * a conversa era possível depois de um F5.
 */
export const conversa = pgTable(
  "conversa",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ambienteId: uuid("ambiente_id")
      .notNull()
      .references(() => ambiente.id, { onDelete: "cascade" }),
    /** Sai da primeira pergunta: ninguém batiza conversa antes de saber o assunto. */
    titulo: text("titulo").notNull(),
    /**
     * A sessão do agente no SDK. É o que dá memória à conversa sem reenviar o
     * histórico a cada turno — e o que se perdia ao fechar a aba.
     */
    sessaoAgente: text("sessao_agente"),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [politicaAmbiente(t.ambienteId), unique("conversa_ambiente_id_uk").on(t.ambienteId, t.id)],
);

export const mensagem = pgTable(
  "mensagem",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ambienteId: uuid("ambiente_id")
      .notNull()
      .references(() => ambiente.id, { onDelete: "cascade" }),
    conversaId: uuid("conversa_id").notNull(),
    /** `usuario`, `agente` ou `erro` — o mesmo vocabulário da tela. */
    papel: text("papel").notNull(),
    corpo: text("corpo").notNull(),
    /** O que o agente consultou para responder. Resposta sem isso vira adivinhação. */
    ferramentas: text("ferramentas").array(),
    modelo: text("modelo"),
    esforco: text("esforco"),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    politicaAmbiente(t.ambienteId),
    // Composta com o ambiente: sem isso uma mensagem poderia apontar para
    // conversa de outro cliente e o banco aceitaria.
    foreignKey({
      columns: [t.ambienteId, t.conversaId],
      foreignColumns: [conversa.ambienteId, conversa.id],
      name: "mensagem_conversa_fk",
    }).onDelete("cascade"),
    index("mensagem_conversa_idx").on(t.ambienteId, t.conversaId, t.ts),
  ],
);

export const evento = pgTable(
  "evento",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ambienteId: uuid("ambiente_id")
      .notNull()
      .references(() => ambiente.id, { onDelete: "cascade" }),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
    tipo: text("tipo").notNull(),
    ator: text("ator").notNull(),
    usuarioId: uuid("usuario_id").references(() => usuario.id),
    // SET NULL e não CASCADE: apagar um brief não pode apagar o registro de
    // que ele existiu.
    briefId: uuid("brief_id"),
    scanId: uuid("scan_id"),
    deEstado: briefEstado("de_estado"),
    paraEstado: briefEstado("para_estado"),
    extra: jsonb("extra").notNull().default({}),
  },
  (t) => [
    foreignKey({
      columns: [t.ambienteId, t.briefId],
      foreignColumns: [brief.ambienteId, brief.id],
    }).onDelete("set null"),
    foreignKey({
      columns: [t.ambienteId, t.scanId],
      foreignColumns: [scan.ambienteId, scan.id],
    }).onDelete("set null"),
    index("evento_ts_idx").on(t.ambienteId, t.ts.desc()),
    index("evento_brief_idx").on(t.ambienteId, t.briefId, t.ts),
    politicaAmbiente(t.ambienteId),
  ],
);
