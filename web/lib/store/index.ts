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

import path from "node:path";
import {
  loadManifest,
  resolvePaths,
  type BriefState,
  type Manifest,
  type RadarPaths,
} from "../manifest";
import { listAllStates, listState, readBrief, type Brief, type StateListing } from "./briefs";
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

/**
 * Identificador do ambiente. Hoje há um só — o valor vem de env para que o
 * ponto de configuração já exista, mesmo sem multi-ambiente.
 */
export type AmbienteId = string;

export const AMBIENTE_PADRAO: AmbienteId = process.env.RADAR_AMBIENTE ?? "avanz-imoveis";

export interface TransicaoEntrada {
  slug: string;
  direcao: Direction;
  motivo?: string;
  ator?: string;
}

export interface RadarStore {
  readonly ambiente: AmbienteId;

  /** O manifest do ambiente. Lido a cada chamada — edição vale sem reiniciar. */
  manifest(): Promise<Manifest>;

  listarEstado(estado: BriefState): Promise<StateListing>;
  listarTodos(): Promise<StateListing[]>;
  listarFila(): Promise<StateListing>;
  buscarBrief(slug: string, estado: BriefState): Promise<Brief>;

  /** Simula a transição sem aplicar — é o que a tela usa para avisar o que se perde. */
  planejarTransicao(entrada: TransicaoEntrada): Promise<TransitionPlan>;
  aplicarTransicao(entrada: TransicaoEntrada): Promise<TransitionResult>;

  lerLedger(): Promise<LedgerReadResult>;
  registrarEvento(evento: Omit<LedgerEvent, "ts"> & { ts?: string }): Promise<LedgerEvent>;

  /**
   * Caminho absoluto de um arquivo de mídia. Existe porque a rota que serve a
   * imagem precisa de um caminho de verdade — e é justamente por isso que ela
   * deve pedir aqui, em vez de montar por conta.
   */
  caminhoMidia(estado: BriefState, arquivo: string): Promise<string>;
}

/** Backend de arquivo. Quando o Postgres entrar, nasce um irmão deste módulo. */
function backendArquivo(ambiente: AmbienteId): RadarStore {
  // Resolvido a cada operação para que edições no manifest valham de imediato.
  const caminhos = async (): Promise<RadarPaths> => resolvePaths(await loadManifest());

  const entradaLegada = (e: TransicaoEntrada) => ({
    slug: e.slug,
    direction: e.direcao,
    reason: e.motivo,
    actor: e.ator,
  });

  return {
    ambiente,

    manifest: loadManifest,

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
      return readBrief(path.join(p.briefsDir[estado], `${slug}.md`), estado, p.mediaDir[estado]);
    },

    async planejarTransicao(entrada) {
      return planTransition({ ...entradaLegada(entrada), dryRun: true }, await caminhos());
    },

    async aplicarTransicao(entrada) {
      return runTransition(entradaLegada(entrada), await caminhos());
    },

    async lerLedger() {
      return readLedger((await caminhos()).ledger);
    },

    async registrarEvento(evento) {
      return appendLedger((await caminhos()).ledger, evento);
    },

    async caminhoMidia(estado, arquivo) {
      const p = await caminhos();
      // basename impede que um nome vindo da URL escape do diretório do estado.
      return path.join(p.mediaDir[estado], path.basename(arquivo));
    },
  };
}

export function radarStore(ambiente: AmbienteId = AMBIENTE_PADRAO): RadarStore {
  return backendArquivo(ambiente);
}

export type { Brief, StateListing, LedgerEvent, LedgerReadResult, TransitionPlan, TransitionResult };
export { APP_ACTOR } from "./ledger";
export { TransitionError } from "../transitions/mv";
