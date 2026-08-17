"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/pieces";
import { ProsaInline } from "@/components/ui/prosa";
import { IconAlert, IconPlug, IconTool } from "@/components/ui/icons";
import { fmtDate } from "@/lib/format";

interface Mensagem {
  id: string;
  role: "user" | "agent" | "error";
  content: string;
  ts: string;
  tool?: { name: string; args: unknown };
  status?: "streaming" | "done";
  code?: string;
}

export interface FilaResumo {
  total: number;
  semArte: number;
  borderline: number;
  matchScoreMin: number;
  borderlineMin: number;
}

const SUGESTOES = [
  "Resuma a fila por pilar",
  "Quais briefs estão sem arte decidida?",
  "O que muda se eu subir o match_score_min?",
];

export function ChatClient({ fila }: { fila: FilaResumo }) {
  const toast = useToast();
  const logRef = useRef<HTMLDivElement>(null);
  const [entrada, setEntrada] = useState("");
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    {
      id: "m1",
      role: "user",
      ts: "2026-06-22T10:02:00-03:00",
      content: "O que tem de borderline na fila hoje?",
    },
    {
      id: "m2",
      role: "agent",
      ts: "2026-06-22T10:02:04-03:00",
      tool: { name: "listState", args: { estado: "pendente-aprovacao", borderline: true } },
      content:
        `Na faixa borderline entram os briefs entre \`borderline_min\` ${fila.borderlineMin} e ` +
        `\`match_score_min\` ${fila.matchScoreMin}.\n\nHoje são **${fila.borderline}** na fila.\n\n` +
        "Eles chegaram aí de propósito: o limiar deixa a decisão com você, não com o matcher.",
    },
  ]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [mensagens]);

  function enviar() {
    const texto = entrada.trim();
    if (!texto) return;
    const agora = new Date().toISOString();
    const pendenteId = `p${Date.now()}`;

    setMensagens((atual) => [
      ...atual,
      { id: `u${Date.now()}`, role: "user", content: texto, ts: agora },
      { id: pendenteId, role: "agent", content: "", ts: agora, status: "streaming" },
    ]);
    setEntrada("");

    setTimeout(() => {
      setMensagens((atual) =>
        atual.map((m) =>
          m.id === pendenteId
            ? {
                ...m,
                status: "done",
                tool: { name: "listState", args: { estado: "pendente-aprovacao" } },
                content:
                  "Sem backend conectado eu não consigo responder de verdade — o que segue é o formato que a resposta vai ter.\n\n" +
                  `Lendo o mesmo store que a fila lê: **${fila.total} briefs** pendentes, **${fila.semArte}** ainda sem \`hero_choice\` decidido e **${fila.borderline}** marcados como borderline.\n\n` +
                  "Quando `onSend` estiver ligado ao endpoint, esta bolha recebe o texto por streaming e as chamadas de ferramenta aparecem acima dela em tempo real.",
              }
            : m,
        ),
      );
    }, 1400);
  }

  return (
    <div className="grid-main">
      <section className="panel chat-shell">
        <div className="disconnected-banner">
          <span>
            <IconPlug />
          </span>
          <span>
            Desconectado — nenhum endpoint de chat configurado. As respostas abaixo são exemplos
            estáticos do formato esperado.
          </span>
        </div>

        <div
          className="chat-log"
          ref={logRef}
          role="log"
          aria-live="polite"
          aria-label="Conversa com o agente"
        >
          {mensagens.length === 0 ? (
            <EmptyState
              title="Nenhuma conversa ainda"
              body="Quando o endpoint existir, o histórico desta sessão aparece aqui. Ele não é persistido em disco — o ledger continua sendo a única memória durável."
            />
          ) : (
            mensagens.map((m) => {
              if (m.role === "user") {
                return (
                  <div className="msg msg-user" key={m.id}>
                    <span className="msg-avatar" aria-hidden="true">
                      EU
                    </span>
                    <div>
                      <div className="msg-name">
                        Editor{" "}
                        <span className="meta" style={{ fontWeight: 400 }}>
                          {fmtDate(m.ts, true)}
                        </span>
                      </div>
                      <div className="msg-body">
                        <ProsaInline texto={m.content} />
                      </div>
                    </div>
                  </div>
                );
              }
              if (m.role === "error") {
                return (
                  <div className="msg msg-agent" key={m.id}>
                    <span className="msg-avatar" aria-hidden="true">
                      !
                    </span>
                    <div>
                      <div className="msg-name">Agente editorial</div>
                      <div className="alert alert-danger" style={{ marginTop: 4 }}>
                        <IconAlert />
                        <div className="alert-body">
                          <strong>{m.code}</strong>
                          <p className="small" style={{ marginTop: 3 }}>
                            {m.content}
                          </p>
                          <button
                            className="btn btn-danger btn-sm"
                            type="button"
                            style={{ marginTop: 9 }}
                            onClick={() =>
                              toast({
                                tone: "danger",
                                title: "Ainda desconectado",
                                detail:
                                  "Nada a retentar enquanto o endpoint não existir. O botão fica aqui pronto para o dia em que existir.",
                              })
                            }
                          >
                            Tentar de novo
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <div className="msg msg-agent" key={m.id}>
                  <span className="msg-avatar" aria-hidden="true">
                    CR
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="msg-name">
                      Agente editorial{" "}
                      <span className="meta" style={{ fontWeight: 400 }}>
                        {fmtDate(m.ts, true)}
                      </span>
                    </div>
                    {m.tool && (
                      <div className="msg-tool">
                        <IconTool /> {m.tool.name}({JSON.stringify(m.tool.args)})
                      </div>
                    )}
                    <div className="msg-body" style={{ marginTop: m.tool ? 8 : 0 }}>
                      {m.status === "streaming" ? (
                        <span className="thinking" aria-label="O agente está pensando">
                          <i />
                          <i />
                          <i />
                        </span>
                      ) : (
                        <ProsaInline texto={m.content} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form
          className="chat-composer"
          onSubmit={(event) => {
            event.preventDefault();
            enviar();
          }}
        >
          <div className="sugestoes">
            {SUGESTOES.map((sugestao) => (
              <button
                className="tag"
                type="button"
                key={sugestao}
                onClick={() => setEntrada(sugestao)}
              >
                {sugestao}
              </button>
            ))}
          </div>
          <div className="composer-row">
            <textarea
              className="textarea"
              rows={2}
              style={{ minHeight: 52 }}
              placeholder="Pergunte sobre a fila, um brief ou a configuração…"
              aria-label="Mensagem para o agente"
              value={entrada}
              onChange={(event) => setEntrada(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  enviar();
                }
              }}
            />
            <button className="btn btn-primary" type="submit" style={{ height: 52 }}>
              Enviar
            </button>
          </div>
          <p className="field-help">
            Enter envia · Shift+Enter quebra linha. Sem backend, o envio devolve a resposta de
            exemplo correspondente.
          </p>
        </form>
      </section>

      <aside className="stack sticky-side">
        <div className="panel">
          <div className="panel-head">
            <h2 className="h3">Contrato de props</h2>
          </div>
          <div className="panel-body" style={{ padding: 12 }}>
            <pre className="code">
              <span className="c-com">{"// components/chat-client.tsx"}</span>
              {"\n"}
              <span className="c-key">type</span> ChatMessage = {"{"}
              {"\n"}  id: string{"\n"}  role: <span className="c-key">&quot;user&quot;</span> |{" "}
              <span className="c-key">&quot;agent&quot;</span> |{" "}
              <span className="c-key">&quot;tool&quot;</span>
              {"\n"}  content: string        <span className="c-com">{"// markdown"}</span>
              {"\n"}  tool?: {"{"} name: string{"\n"}           args: unknown{"\n"}           result?: unknown {"}"}
              {"\n"}  status?: <span className="c-key">&quot;streaming&quot;</span> |{" "}
              <span className="c-key">&quot;done&quot;</span>
              {"\n"}           | <span className="c-key">&quot;error&quot;</span>
              {"\n"}  ts: string{"\n"}
              {"}"}
              {"\n\n"}
              <span className="c-key">type</span> AgentChatProps = {"{"}
              {"\n"}  messages: ChatMessage[]{"\n"}  connected: boolean{"\n"}  pending: boolean
              {"\n"}  onSend: (text: string) =&gt; void{"\n"}  onCancel?: () =&gt; void
              {"\n"}  error?: {"{"} code: string{"\n"}            message: string {"}"}
              {"\n"}
              {"}"}
            </pre>
            <p className="field-help" style={{ marginTop: 12 }}>
              O backend futuro só precisa preencher isso. Nenhum estado do chat mora fora dessas
              props — a casca já é controlada.
            </p>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2 className="h3">Estados cobertos</h2>
          </div>
          <div className="panel-body stack-sm">
            {[
              ["agora", "Desconectado", "pill-accent"],
              ["ok", "Pensando / streaming", ""],
              ["ok", "Mensagem de ferramenta", ""],
              ["ok", "Erro do agente", ""],
              ["ok", "Histórico vazio", ""],
            ].map(([rotulo, texto, cls]) => (
              <div className="row-tight" key={texto}>
                <span className={`pill pill-bare ${cls}`}>{rotulo}</span>
                <span className="small">{texto}</span>
              </div>
            ))}
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              style={{ marginTop: 6 }}
              onClick={() =>
                setMensagens((atual) => [
                  ...atual,
                  {
                    id: `e${Date.now()}`,
                    role: "error",
                    code: "AGENT_UNAVAILABLE",
                    ts: new Date().toISOString(),
                    content:
                      "Nenhum endpoint de chat configurado em RADAR_AGENT_URL. A fila, o acervo e a configuração continuam funcionando normalmente — o chat é o único recurso afetado.",
                  },
                ])
              }
            >
              Ver o estado de erro
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
