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
   * Quais blocos de tipo config já estão satisfeitos. Não vêm do vault: o
   * conteúdo deles é configuração, e sem isto `fontes` — que é obrigatório —
   * travaria o pipeline de um ambiente já configurado.
   */
  estadoDaConfig(): Promise<{ temFontes: boolean; temAjustes: boolean }>;

  /**
   * Grava uma versão nova do bloco. `motivo` é obrigatório: prosa não tem
   * validação automática, então o histórico é a única rede de segurança — e
   * histórico sem o porquê responde metade da pergunta.
   */
  gravarBloco(slug: string, corpo: string, motivo: string): Promise<void>;

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

    async estadoDaConfig() {
      const manifest = await loadManifest();
      return {
        temFontes: Object.keys(manifest.search_scopes).length > 0,
        temAjustes: true,
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
  return backendPostgres(sessao.ambienteId);
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
