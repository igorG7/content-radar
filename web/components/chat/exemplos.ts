import type { Anexo } from "./chat-client";

/**
 * As formas que a conversa tem na tela.
 *
 * Nada disto é persistido ainda: o histórico vive na aba do navegador. A
 * memória do agente, essa sim, fica no servidor — é a `sessaoAgente` da
 * conversa.
 */
export interface Mensagem {
  id: string;
  role: "user" | "agent" | "error";
  content: string;
  ts: string;
  /** As ferramentas que o agente consultou para responder, em ordem. */
  ferramentas?: string[];
  status?: "streaming" | "done" | "stopped";
  modelo?: string;
  esforco?: string;
  anexos?: Anexo[];
  code?: string;
}

export interface Conversa {
  id: string;
  titulo: string;
  atualizado_em: string;
  mensagens: Mensagem[];
  /**
   * Sessão do agente, devolvida pelo servidor a cada turno. É o que faz a
   * conversa ter memória sem o navegador reenviar o histórico inteiro.
   */
  sessaoAgente?: string;
}

/**
 * A conversa vazia com que a tela abre.
 *
 * Aqui havia três conversas de exemplo, com perguntas e respostas plausíveis.
 * Faziam sentido enquanto não existia backend; agora o agente responde de
 * verdade, e histórico de conversas que ninguém teve é mentira na tela.
 *
 * Conversa ainda não é persistida: recarregar a página perde o que foi dito. A
 * sessão do agente vive no servidor, mas o ponteiro para ela mora aqui.
 */
export const conversaVazia = (): Conversa => ({
  id: `c${Date.now()}`,
  titulo: "Nova conversa",
  atualizado_em: new Date().toISOString(),
  mensagens: [],
});
