import type { Anexo } from "./chat-client";

/**
 * Conversas de exemplo — a forma que o stream futuro precisa produzir. Cada
 * uma tem histórico e título próprios; a lista é ordenada por atividade.
 * Nada disto é persistido: o histórico vive na sessão do navegador e o ledger
 * continua sendo a única memória durável.
 */
export interface Mensagem {
  id: string;
  role: "user" | "agent" | "error";
  content: string;
  ts: string;
  tool?: { name: string; args: unknown };
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
}

export const CONVERSAS_EXEMPLO: Conversa[] = [
  {
    id: "c1",
    titulo: "Borderline na fila de hoje",
    atualizado_em: "2026-08-16T10:04:16-03:00",
    mensagens: [
      {
        id: "m1",
        role: "user",
        ts: "2026-08-16T10:02:00-03:00",
        content: "O que tem de borderline na fila hoje?",
      },
      {
        id: "m2",
        role: "agent",
        ts: "2026-08-16T10:02:04-03:00",
        tool: { name: "listState", args: { estado: "pendente-aprovacao", borderline: true } },
        content:
          "Borderline é a faixa entre `borderline_min` e `match_score_min`: o limiar deixa a decisão com você, não com o matcher.\n" +
          "\nCada um deles chegou à fila de propósito — o score não foi alto o bastante para promover sozinho, nem baixo o bastante para descartar.",
      },
    ],
  },
  {
    id: "c2",
    titulo: "Efeito de subir o match_score_min",
    atualizado_em: "2026-08-15T16:40:00-03:00",
    mensagens: [
      {
        id: "a1",
        role: "user",
        ts: "2026-08-15T16:38:00-03:00",
        content: "Se eu subir o match_score_min para 0,60, quantos briefs da semana sobrevivem?",
      },
      {
        id: "a2",
        role: "agent",
        ts: "2026-08-15T16:38:09-03:00",
        tool: { name: "simulateThreshold", args: { match_score_min: 0.6 } },
        content:
          "Subir o corte tira os briefs de menor score — em geral os que já estavam marcados como borderline.\n" +
          "\nO efeito colateral é na meta: `candidates_per_week_target` continua o mesmo, e com o corte mais alto a varredura precisa de mais fontes para chegar lá. Subir o limiar sem mexer nos escopos costuma virar semana vazia.",
      },
    ],
  },
  {
    id: "c3",
    titulo: "Sítios em Jaboticatubas — o que checar",
    atualizado_em: "2026-08-13T09:12:00-03:00",
    mensagens: [
      {
        id: "b1",
        role: "user",
        ts: "2026-08-13T09:10:00-03:00",
        content: "O brief de sítio em Jaboticatubas cita outorga de água. Isso é guardrail?",
      },
      {
        id: "b2",
        role: "agent",
        ts: "2026-08-13T09:10:07-03:00",
        tool: { name: "readVaultBlock", args: { bloco: "guardrails" } },
        content:
          "É. O bloco de **guardrails** proíbe afirmar que existe outorga sem o número do processo — a copy pode dizer que a checagem é necessária, nunca que ela está resolvida.\n" +
          "\nO brief atual está do lado certo: ele lista a outorga como dúvida a verificar antes do sinal.",
      },
    ],
  },
];
