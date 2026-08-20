/**
 * Camada de armazenamento — o único lugar que sabe ONDE os dados vivem.
 *
 * Tudo fora daqui pede em termos de domínio ("a fila", "este brief", "aprovar")
 * e nunca em termos de caminho. É o que permite trocar arquivo por banco sem
 * tocar em página nenhuma: a interface é de domínio, a implementação é detalhe.
 *
 * O `ambiente` é parâmetro do módulo, não disciplina espalhada. Hoje ele é
 * único e os caminhos ignoram o valor; quando o Postgres entrar, ele vira o
 * `SET LOCAL app.ambiente` que sustenta o row-level security
 * (docs/design-esquema-banco.md §2). Por isso a assinatura já o recebe: sem
 * isso, migrar significaria mexer nos mesmos pontos de chamada duas vezes.
 *
 * REGRA: nada fora de lib/store/ importa `resolvePaths`, `briefsDir`,
 * `mediaDir` ou monta caminho de brief/mídia. Ver docs/design-migracao.md §3.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  loadManifest,
  MANIFEST_PATH,
  RADAR_ROOT,
  resolvePaths,
  type BriefState,
  type Manifest,
  type RadarPaths,
} from "../manifest";
import {
  listAllStates,
  listState,
  readBrief,
  type Brief,
  type StateListing,
} from "./briefs";
import {
  patchScalars,
  readFileWithFrontmatter,
  replaceFrontmatterFields,
} from "./frontmatter";
import {
  appendLedger,
  readLedger,
  type LedgerEvent,
  type LedgerReadResult,
} from "./ledger";
import {
  planTransition,
  runTransition,
  type Direction,
  type TransitionPlan,
  type TransitionResult,
} from "../transitions/mv";

/** Identificador do ambiente — o mesmo valor que sustenta o RLS no banco. */
export type AmbienteId = string;

/** Só o backend de arquivo usa: lá o ambiente é rótulo, não escopo de consulta. */
export const AMBIENTE_PADRAO: AmbienteId =
  process.env.RADAR_AMBIENTE ?? "avanz-imoveis";

export interface TransicaoEntrada {
  slug: string;
  direcao: Direction;
  motivo?: string;
  ator?: string;
}

/** Recusas de regra da camada — o chamador traduz para status HTTP. */
export class StoreError extends Error {
  constructor(
    readonly code: "nao_encontrado" | "candidata_invalida",
    message: string,
  ) {
    super(message);
    this.name = "StoreError";
  }
}

/**
 * Um scan simultâneo por ambiente. Recusa, não erro: a fila do servidor tem
 * outro limite, e este aqui é justiça entre clientes (design-execucao-scan §4).
 */
export class JaRodando extends Error {
  constructor() {
    super("já existe uma varredura em andamento neste ambiente");
    this.name = "JaRodando";
  }
}

export interface Configuracao {
  pesos: Record<string, number>;
  caps: Record<string, number>;
  janelas: Record<string, number | string>;
  volume: Record<string, number | string>;
}

export interface Contato {
  canalPrincipal: string;
  telefoneExibicao: string | null;
  telefoneE164: string | null;
  telefoneSecundarioE164: string | null;
}

export interface EscopoBusca {
  slug: string;
  label: string;
  ativo: boolean;
  fontes: { slug: string; url: string; nota: string | null; ativo: boolean }[];
  pilares: string[];
}

/** Um caminho no documento e o valor novo — mesma forma que a tela já usa. */
export interface EdicaoConfig {
  path: (string | number)[];
  value: unknown;
}

/** Um bloco do vault, como o banco o guarda. */
export interface BlocoVault {
  slug: string;
  titulo: string;
  corpo: string;
  ordem: number;
  escopo: string;
  contrato: string;
  versao: number;
  atualizadoEm: string;
}

export interface Publicacao {
  igPostUrl: string;
  publicadoEm: Date;
}

/**
 * O pedido de varredura. Vive aqui e não no executor porque é vocabulário de
 * domínio: a tela monta um destes, a fila guarda um destes, e o executor é só
 * quem acaba rodando.
 */
export interface PedidoDeScan {
  escopo: string;
  pilar?: string;
  alvo?: number;
}

export type Estagio = "pesquisa" | "filtragem" | "redacao";

/**
 * Uma varredura em voo, como a tela precisa vê-la.
 *
 * `posicao` só existe enquanto o pedido espera vaga global: sem ela,
 * "iniciando" fica parado por minutos sem explicação (design-execucao-scan §7).
 */
export interface ScanEmAndamento {
  scanId: string;
  scanRef: string;
  estado: "enfileirado" | "rodando" | Estagio;
  pedido: PedidoDeScan;
  pedidoEm: string;
  iniciadoEm: string | null;
  posicao: number | null;
  /** Cada estágio já atingido, com o minuto e a contagem parcial que produziu. */
  estagios: {
    estagio: Estagio;
    minuto: number;
    extra: Record<string, unknown>;
  }[];
}

/**
 * Os pilares e públicos do ambiente — o vocabulário com que se fala de pauta.
 *
 * Existe para o chat: sem isto o agente teria de adivinhar quais pilares
 * existem, e um `--pillar` inventado só falharia dentro da execução, vinte
 * minutos e um custo depois.
 */
export interface Vocabulario {
  pilares: {
    slug: string;
    nome: string;
    corpo: string;
    ordem: number;
    noRadar: boolean;
  }[];
  publicos: { slug: string; nome: string; corpo: string; padrao: boolean }[];
}

/** Campos do brief que a edição pela interface pode tocar. */
export interface EdicaoBrief {
  headline?: string | null;
  hook?: string | null;
  caption_draft?: string | null;
  hashtags?: string[];
  cta?: string | null;
  suggested_slot?: string | null;
  format?: string | null;
  review_notes?: string | null;
  visual_brief?: Record<string, unknown>;
}

export interface RadarStore {
  readonly ambiente: AmbienteId;

  /** O manifest do ambiente. Lido a cada chamada — edição vale sem reiniciar. */
  manifest(): Promise<Manifest>;

  /**
   * O manifest como texto. A tela de configuração edita por recorte cirúrgico
   * do YAML, preservando comentários e formatação, então precisa do documento
   * bruto — não da árvore desserializada.
   */
  lerManifestBruto(): Promise<string>;
  gravarManifestBruto(texto: string): Promise<void>;

  listarEstado(estado: BriefState): Promise<StateListing>;
  listarTodos(): Promise<StateListing[]>;
  listarFila(): Promise<StateListing>;
  buscarBrief(slug: string, estado: BriefState): Promise<Brief>;

  /** Simula a transição sem aplicar — é o que a tela usa para avisar o que se perde. */
  planejarTransicao(entrada: TransicaoEntrada): Promise<TransitionPlan>;
  aplicarTransicao(entrada: TransicaoEntrada): Promise<TransitionResult>;

  /**
   * Grava a escolha de arte do humano. Separada da transição para que a
   * escolha persista no instante em que é feita, e aprovar continue sendo só
   * um movimento. `null` é decisão válida: sem foto, o Smart Design gera a arte.
   */
  gravarEscolhaHero(slug: string, indice: number | null): Promise<void>;

  /** Edição de copy pela interface. Só nos estados em que o brief ainda muda. */
  editarBrief(
    estado: "pendente-aprovacao" | "pendente-publicacao",
    slug: string,
    campos: EdicaoBrief,
  ): Promise<void>;

  /**
   * Os blocos do vault do ambiente. O corpo é do cliente; a pergunta que gera
   * o bloco é do produto e vive no catálogo (lib/vault/blocos.ts).
   */
  listarBlocos(): Promise<BlocoVault[]>;

  /**
   * A configuração operacional do ambiente: pesos do score, caps, janelas de
   * anti-repetição e volume. É o que o `manifest.yaml` guardava — e continua
   * guardando enquanto as skills lerem o arquivo (ver `gravarConfiguracao`).
   */
  configuracao(): Promise<Configuracao>;

  /** Fatos estáveis da marca — valores, não prosa (bloco `contato`). */
  contato(): Promise<Contato | null>;
  gravarContato(dados: Contato): Promise<void>;

  /** Os escopos de busca com suas fontes e os pilares que cada um alimenta. */
  escoposDeBusca(): Promise<EscopoBusca[]>;

  /** Pilares e públicos do ambiente. É o vocabulário editorial, não a prosa. */
  vocabulario(): Promise<Vocabulario>;

  /**
   * Grava a configuração. O banco é a fonte da verdade; o `manifest.yaml`
   * recebe a mesma mudança por recorte cirúrgico enquanto as skills o lerem —
   * é projeção, não segunda fonte, e some quando a injeção entrar (fase 4).
   */
  gravarConfiguracao(edicoes: EdicaoConfig[]): Promise<void>;

  /**
   * Quais blocos de tipo config já estão satisfeitos. Não vêm do vault: o
   * conteúdo deles é configuração, e sem isto `fontes` — que é obrigatório —
   * travaria o pipeline de um ambiente já configurado.
   */
  estadoDaConfig(): Promise<{
    temFontes: boolean;
    temAjustes: boolean;
    temContato: boolean;
  }>;

  /**
   * Grava uma versão nova do bloco. `motivo` é obrigatório: prosa não tem
   * validação automática, então o histórico é a única rede de segurança — e
   * histórico sem o porquê responde metade da pergunta.
   */
  gravarBloco(slug: string, corpo: string, motivo: string): Promise<void>;

  /**
   * Fecha o ciclo: o post saiu no Instagram. Publicar é ato humano fora do
   * produto — o que o app registra é que aconteceu, com a URL como prova.
   */
  marcarPublicado(slug: string, dados: Publicacao): Promise<void>;

  /**
   * O package do handoff, como **um `.md` para download**.
   *
   * Eram cinco arquivos numa pasta; quatro são texto e cabem num só, e a foto
   * não precisa caber porque depois do upload ela é uma URL. Ver
   * design-persistencia-multiusuario §4.1.
   */
  exportar(slug: string): Promise<{ nome: string; conteudo: string }>;

  /**
   * Pede uma varredura. **Não roda nada** — quem roda é o trabalhador, noutro
   * processo, porque o scan leva de 12 a 63 minutos.
   *
   * Recusa com `JaRodando` se este ambiente já tem uma em andamento. Recusar é
   * melhor que enfileirar em silêncio: a pessoa descobriria o acúmulo só
   * depois, quando dois scans idênticos gerassem pauta repetida.
   */
  enfileirarScan(
    pedido: PedidoDeScan,
  ): Promise<{ scanId: string; scanRef: string; posicao: number }>;

  /** A varredura em voo deste ambiente, ou `null`. É o que a tela acompanha. */
  scanEmAndamento(): Promise<ScanEmAndamento | null>;

  lerLedger(): Promise<LedgerReadResult>;
  registrarEvento(
    evento: Omit<LedgerEvent, "ts"> & { ts?: string },
  ): Promise<LedgerEvent>;

  /**
   * Bytes de um arquivo de mídia, ou `null` se não estiver no cache. Devolve
   * conteúdo e não caminho porque com armazenamento de objetos não haverá
   * caminho — a rota que serve a imagem não deve depender de haver disco.
   */
  lerMidia(
    estado: BriefState,
    arquivo: string,
  ): Promise<Uint8Array<ArrayBuffer> | null>;

  /**
   * Caminho absoluto de um arquivo de mídia. Necessário enquanto o backend é
   * arquivo (o script de transição remaneja mídia no disco). Some quando a
   * mídia sair para armazenamento de objetos.
   */
  caminhoMidia(estado: BriefState, arquivo: string): Promise<string>;
}

/** Backend de arquivo. Quando o Postgres entrar, nasce um irmão deste módulo. */
function backendArquivo(ambiente: AmbienteId): RadarStore {
  // Resolvido a cada operação para que edições no manifest valham de imediato.
  const caminhos = async (): Promise<RadarPaths> =>
    resolvePaths(await loadManifest());

  const entradaLegada = (e: TransicaoEntrada) => ({
    slug: e.slug,
    direction: e.direcao,
    reason: e.motivo,
    actor: e.ator,
  });

  return {
    ambiente,

    manifest: loadManifest,

    async lerManifestBruto() {
      return readFile(MANIFEST_PATH, "utf8");
    },

    async gravarManifestBruto(texto) {
      await writeFile(MANIFEST_PATH, texto, "utf8");
    },

    async listarEstado(estado) {
      return listState(estado, await caminhos());
    },

    async listarTodos() {
      return listAllStates(await caminhos());
    },

    async listarFila() {
      return listState("pendente-aprovacao", await caminhos());
    },

    async buscarBrief(slug, estado) {
      const p = await caminhos();
      return readBrief(
        path.join(p.briefsDir[estado], `${slug}.md`),
        estado,
        p.mediaDir[estado],
      );
    },

    async planejarTransicao(entrada) {
      return planTransition(
        { ...entradaLegada(entrada), dryRun: true },
        await caminhos(),
      );
    },

    async aplicarTransicao(entrada) {
      return runTransition(entradaLegada(entrada), await caminhos());
    },

    async gravarEscolhaHero(slug, indice) {
      const p = await caminhos();
      const filePath = path.join(
        p.briefsDir["pendente-aprovacao"],
        `${slug}.md`,
      );

      let data: Record<string, unknown>;
      try {
        ({ data } = await readFileWithFrontmatter(filePath));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          throw new StoreError(
            "nao_encontrado",
            "brief não está em pendente-aprovacao",
          );
        }
        throw error;
      }

      if (indice !== null) {
        const candidatas = Array.isArray(data.hero_image_candidates)
          ? (data.hero_image_candidates as { index?: unknown }[])
          : [];
        if (!candidatas.some((c) => c?.index === indice)) {
          throw new StoreError(
            "candidata_invalida",
            `não existe candidata com índice ${indice}`,
          );
        }
      }

      const raw = await readFile(filePath, "utf8");
      await writeFile(
        filePath,
        patchScalars(raw, { hero_choice: indice }),
        "utf8",
      );
    },

    async editarBrief(estado, slug, campos) {
      const p = await caminhos();
      const filePath = path.join(p.briefsDir[estado], `${slug}.md`);

      try {
        await readFileWithFrontmatter(filePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          throw new StoreError(
            "nao_encontrado",
            "brief não encontrado neste estado",
          );
        }
        throw error;
      }

      await replaceFrontmatterFields(
        filePath,
        campos as Record<string, unknown>,
      );
    },

    async marcarPublicado() {
      throw new StoreError(
        "nao_encontrado",
        "o backend de arquivo não marca publicação",
      );
    },

    async exportar() {
      throw new StoreError(
        "nao_encontrado",
        "o backend de arquivo não exporta package",
      );
    },

    async enfileirarScan() {
      throw new StoreError(
        "nao_encontrado",
        "o backend de arquivo não tem fila — a varredura vive no banco",
      );
    },

    async scanEmAndamento() {
      return null;
    },

    async vocabulario(): Promise<Vocabulario> {
      // Pilares e públicos são prosa do vault, e o manifest não os descreve.
      // Devolver vazio faria parecer que o ambiente não tem nenhum.
      throw new StoreError(
        "nao_encontrado",
        "o backend de arquivo não conhece o vocabulário — ele vive no vault",
      );
    },

    async listarBlocos(): Promise<BlocoVault[]> {
      // O store de arquivos nunca teve vault: ele vive no espaço de trabalho da
      // empresa, fora daqui. Devolver lista vazia faria a interface concluir
      // que o vault está por preencher.
      throw new StoreError(
        "nao_encontrado",
        "o backend de arquivo não guarda vault",
      );
    },

    async gravarBloco() {
      throw new StoreError(
        "nao_encontrado",
        "o backend de arquivo não guarda vault",
      );
    },

    async configuracao(): Promise<Configuracao> {
      const m = await loadManifest();
      return {
        pesos: m.anti_repetition.match_score_weights,
        caps: {
          match_score_min: m.anti_repetition.match_score_min,
          borderline_min: m.anti_repetition.borderline_min,
          ...(m.anti_repetition.geografia_reframe_floor !== undefined
            ? {
                geografia_reframe_floor:
                  m.anti_repetition.geografia_reframe_floor,
              }
            : {}),
        },
        janelas: (m.anti_repetition.windows ?? {}) as Record<
          string,
          number | string
        >,
        volume: {
          candidates_per_week_target: m.funnel.candidates_per_week_target,
        },
      };
    },

    async contato(): Promise<Contato | null> {
      const m = await loadManifest();
      const f = (
        m as { target_company?: { brand_facts?: Record<string, string> } }
      ).target_company?.brand_facts;
      return f
        ? {
            canalPrincipal: f.main_channel ?? "WhatsApp",
            telefoneExibicao: f.phone_display ?? null,
            telefoneE164: f.phone_e164 ?? null,
            telefoneSecundarioE164: f.phone_secondary_e164 ?? null,
          }
        : null;
    },

    async gravarContato() {
      throw new StoreError(
        "nao_encontrado",
        "o backend de arquivo não grava contato",
      );
    },

    async escoposDeBusca(): Promise<EscopoBusca[]> {
      const m = await loadManifest();
      return Object.entries(m.search_scopes).map(([slug, escopo]) => ({
        slug,
        label: escopo.label,
        ativo: true,
        fontes: escopo.sources.map((f) => ({
          slug: f,
          url: f,
          nota: null,
          ativo: true,
        })),
        pilares: escopo.pillars_alvo ?? [],
      }));
    },

    async gravarConfiguracao() {
      throw new StoreError(
        "nao_encontrado",
        "o backend de arquivo não grava configuração",
      );
    },

    async estadoDaConfig() {
      const manifest = await loadManifest();
      return {
        temFontes: Object.keys(manifest.search_scopes).length > 0,
        temAjustes: true,
        temContato: Boolean(manifest.target_company?.slug),
      };
    },

    async lerLedger() {
      return readLedger((await caminhos()).ledger);
    },

    async registrarEvento(evento) {
      return appendLedger((await caminhos()).ledger, evento);
    },

    async lerMidia(estado, arquivo) {
      try {
        return Uint8Array.from(
          await readFile(await this.caminhoMidia(estado, arquivo)),
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },

    async caminhoMidia(estado, arquivo) {
      const p = await caminhos();
      // basename impede que um nome vindo da URL escape do diretório do estado.
      return path.join(p.mediaDir[estado], path.basename(arquivo));
    },
  };
}

/**
 * Backend de arquivo, explícito. É o que o importador usa — a função dele é
 * justamente ler arquivos, então pedir "o store" e receber o banco seria ler o
 * que ele está tentando popular.
 */
export function storeDeArquivo(
  ambiente: AmbienteId = AMBIENTE_PADRAO,
): RadarStore {
  return backendArquivo(ambiente);
}

/**
 * O store do ambiente da sessão. Assíncrono porque o ambiente vem do cookie, e
 * é ele que vira `SET LOCAL app.ambiente` na transação.
 *
 * Nenhum ponto de chamada passa o ambiente à mão: fazer isso traria de volta a
 * disciplina espalhada que a camada existe para eliminar, agora com o dado que
 * separa um cliente do outro.
 */
export async function radarStore(): Promise<RadarStore> {
  if (process.env.RADAR_BACKEND === "arquivo" || !process.env.DATABASE_URL) {
    return backendArquivo(AMBIENTE_PADRAO);
  }

  const { sessaoAtual } = await import("../sessao");
  const sessao = await sessaoAtual();
  if (!sessao) throw new SemSessao();

  const { backendPostgres } = await import("../../db/backend");
  const { credenciais, enviador } = await import("../midia/cloudinary");

  // Sem credencial o app continua inteiro: a escolha da arte é gravada, e o
  // que falta é só a cópia remota — que o pacote diz na cara que não tem.
  const cred = await credenciais(RADAR_ROOT);
  return backendPostgres(sessao.ambienteId, {
    enviarParaNuvem: cred ? enviador(cred) : null,
  });
}

/** Sem sessão não há ambiente, e sem ambiente o banco não devolve nada. */
export class SemSessao extends Error {
  constructor() {
    super("sem sessão — não há ambiente para consultar");
    this.name = "SemSessao";
  }
}

export type {
  Brief,
  StateListing,
  LedgerEvent,
  LedgerReadResult,
  TransitionPlan,
  TransitionResult,
};
export { APP_ACTOR } from "./ledger";
export { TransitionError } from "../transitions/mv";
