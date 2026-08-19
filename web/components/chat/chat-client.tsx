"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/pieces";
import { ProsaInline } from "@/components/ui/prosa";
import {
  IconAlert,
  IconCheck,
  IconClip,
  IconFile,
  IconPencil,
  IconPlug,
  IconPlus,
  IconSliders,
  IconStop,
  IconTool,
  IconTrash,
} from "@/components/ui/icons";
import { fmtDate, fmtRelative } from "@/lib/format";
import {
  CHAT_ESFORCOS,
  CHAT_MODELOS,
  gravarEsforco,
  gravarModelo,
  rotuloEsforco,
  rotuloModelo,
  useEsforco,
  useModelo,
  type EsforcoId,
  type ModeloId,
} from "@/lib/session";
import { CONVERSAS_EXEMPLO, type Conversa, type Mensagem } from "./exemplos";

export interface FilaResumo {
  total: number;
  semArte: number;
  borderline: number;
  matchScoreMin: number;
  borderlineMin: number;
}

export interface Anexo {
  id: string;
  nome: string;
  tamanho: number;
  mime: string;
  /** Blob URL local; só existe para imagem. Nada sobe para servidor algum. */
  url: string | null;
}

const MAX_ARQUIVOS = 5;
const MAX_MB = 10;
const TIPOS_OK = /^(image\/(png|jpeg|webp)|application\/(pdf|json)|text\/.*)$/;
const EXT_OK = /\.(png|jpe?g|webp|pdf|md|txt|csv|ya?ml|json)$/i;
const ACCEPT =
  "image/png,image/jpeg,image/webp,application/pdf,.md,.txt,.csv,.yaml,.yml,.json";

const SUGESTOES = [
  "Resuma a fila por pilar",
  "Quais briefs estão sem arte decidida?",
  "O que muda se eu subir o match_score_min?",
];

/** Esforço alto demora mais — a espera é o que faz a escolha significar algo. */
const ESPERA: Record<EsforcoId, number> = {
  baixo: 700,
  medio: 1400,
  alto: 2600,
};

const tamanhoLegivel = (n: number) =>
  n < 1024
    ? `${n} B`
    : n < 1024 * 1024
      ? `${(n / 1024).toFixed(0)} KB`
      : `${(n / 1048576).toFixed(1).replace(".", ",")} MB`;

/** Agrupada por recência: a pessoa procura “a de ontem”, não a de índice 3. */
function grupoDe(ts: string, agora: number): string {
  const dias = (agora - new Date(ts).getTime()) / 86400000;
  if (dias < 1) return "Hoje";
  if (dias < 2) return "Ontem";
  if (dias < 8) return "Últimos 7 dias";
  return "Antes";
}

function resumoDe(conversa: Conversa): string {
  const ultima = conversa.mensagens[conversa.mensagens.length - 1];
  if (!ultima) return "Sem mensagens ainda";
  if (ultima.status === "streaming") return "Respondendo…";
  // Marcação sai sem deixar espaço no lugar, senão a prévia ganha " , ".
  const texto = (ultima.content || "")
    .replace(/[*`#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const rotulo = ultima.role === "user" ? "Você: " : "";
  if (!texto && ultima.anexos?.length)
    return `${rotulo}${ultima.anexos.length} anexo(s)`;
  return rotulo + (texto.slice(0, 64) || "—");
}

function AnexoChip({
  anexo,
  onRemover,
}: {
  anexo: Anexo;
  onRemover?: () => void;
}) {
  return (
    <span className="attach-chip">
      {anexo.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="attach-thumb" src={anexo.url} alt="" />
      ) : (
        <IconFile />
      )}
      <span className="attach-txt">
        <span className="attach-nome" title={anexo.nome}>
          {anexo.nome}
        </span>
        <span className="attach-tam">{tamanhoLegivel(anexo.tamanho)}</span>
      </span>
      {onRemover && (
        <button
          className="btn btn-ghost btn-icon btn-sm"
          type="button"
          aria-label={`Remover ${anexo.nome}`}
          title="Remover"
          onClick={onRemover}
        >
          ×
        </button>
      )}
    </span>
  );
}

export function ChatClient({
  fila,
  agoraIso,
}: {
  fila: FilaResumo;
  agoraIso: string;
}) {
  const toast = useToast();
  const logRef = useRef<HTMLDivElement>(null);
  const entradaRef = useRef<HTMLTextAreaElement>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const maisRef = useRef<HTMLButtonElement>(null);
  const resumoRef = useRef<HTMLButtonElement>(null);
  // O timer é detalhe de agendamento e mora num ref; qual conversa está
  // esperando é estado, porque o composer troca Enviar por Parar por causa dele.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendencia, setPendencia] = useState<{
    conversaId: string;
    msgId: string;
  } | null>(null);

  const [conversas, setConversas] = useState<Conversa[]>(CONVERSAS_EXEMPLO);
  const [ativa, setAtiva] = useState(CONVERSAS_EXEMPLO[0].id);
  const [entrada, setEntrada] = useState("");
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [erroAnexo, setErroAnexo] = useState<string | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [renomeando, setRenomeando] = useState<Conversa | null>(null);
  const [tituloDraft, setTituloDraft] = useState("");
  const [tituloErro, setTituloErro] = useState(false);
  const [excluindo, setExcluindo] = useState<Conversa | null>(null);

  const modelo = useModelo();
  const esforco = useEsforco();

  const conversa = conversas.find((c) => c.id === ativa) ?? conversas[0];
  const pendente = pendencia?.conversaId === conversa?.id;

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [conversa?.mensagens]);

  // Blob URLs vivem até serem revogadas; sem isto, cada anexo de imagem vaza.
  useEffect(() => {
    return () => {
      for (const anexo of anexos) if (anexo.url) URL.revokeObjectURL(anexo.url);
    };
  }, [anexos]);

  const atualizar = useCallback(
    (id: string, muda: (c: Conversa) => Conversa) =>
      setConversas((atual) => atual.map((c) => (c.id === id ? muda(c) : c))),
    [],
  );

  /* ── anexos ───────────────────────────────────────────────────────────── */
  const adicionar = useCallback((arquivos: FileList | File[]) => {
    const recusados: string[] = [];
    setAnexos((atual) => {
      const proximo = [...atual];
      for (const f of Array.from(arquivos)) {
        if (proximo.length >= MAX_ARQUIVOS) {
          recusados.push(`${f.name} — limite de ${MAX_ARQUIVOS} arquivos`);
          continue;
        }
        if (!TIPOS_OK.test(f.type) && !EXT_OK.test(f.name)) {
          recusados.push(`${f.name} — tipo não aceito`);
          continue;
        }
        if (f.size > MAX_MB * 1048576) {
          recusados.push(
            `${f.name} — ${tamanhoLegivel(f.size)}, acima de ${MAX_MB} MB`,
          );
          continue;
        }
        if (proximo.some((a) => a.nome === f.name && a.tamanho === f.size)) {
          recusados.push(`${f.name} — já anexado`);
          continue;
        }
        proximo.push({
          id: `${f.name}-${f.size}-${proximo.length}`,
          nome: f.name,
          tamanho: f.size,
          mime: f.type || "",
          url: /^image\//.test(f.type) ? URL.createObjectURL(f) : null,
        });
      }
      return proximo;
    });
    // Recusa nomeia arquivo e motivo: "não deu" não diz o que corrigir.
    setErroAnexo(recusados.length ? recusados.join(" · ") : null);
  }, []);

  /* ── enviar, responder, interromper ───────────────────────────────────── */
  function responder(conversaId: string) {
    const msgId = `p${Date.now()}`;
    const agora = new Date().toISOString();
    atualizar(conversaId, (c) => ({
      ...c,
      mensagens: [
        ...c.mensagens,
        {
          id: msgId,
          role: "agent",
          status: "streaming",
          content: "",
          modelo,
          esforco,
          ts: agora,
        },
      ],
    }));

    const timer = setTimeout(() => {
      setPendencia(null);
      setConversas((atual) =>
        atual.map((c) => {
          if (c.id !== conversaId) return c;
          const enviados = [...c.mensagens]
            .reverse()
            .find((m) => m.role === "user")?.anexos;
          const texto =
            (enviados?.length
              ? `Recebi **${enviados.length} arquivo(s)**: ${enviados.map((a) => `\`${a.nome}\``).join(", ")}. ` +
                "Sem backend eu não consigo abrir nem ler o conteúdo — o arquivo ficou só no seu navegador. " +
                "Quando `onSend` estiver ligado, ele sobe junto com a mensagem.\n\n"
              : "") +
            "Sem backend conectado eu não consigo responder de verdade — o que segue é o formato que a resposta vai ter.\n" +
            `\nLendo o mesmo store que a fila lê: **${fila.total} briefs** pendentes, **${fila.semArte}** ainda sem \`hero_choice\` decidido e **${fila.borderline}** marcados como borderline.` +
            "\n\nQuando `onSend` estiver ligado ao endpoint, esta bolha recebe o texto por streaming e as chamadas de ferramenta aparecem acima dela em tempo real.";
          return {
            ...c,
            mensagens: c.mensagens.map((m) =>
              m.id === msgId
                ? {
                    ...m,
                    status: "done",
                    tool: {
                      name: "listState",
                      args: { estado: "pendente-aprovacao" },
                    },
                    content: texto,
                  }
                : m,
            ),
          };
        }),
      );
    }, ESPERA[esforco]);

    timerRef.current = timer;
    setPendencia({ conversaId, msgId });
  }

  /**
   * Parar não apaga a bolha — deixa registrado que houve uma resposta
   * interrompida, e por quem.
   */
  const parar = useCallback(() => {
    if (!pendencia) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setPendencia(null);
    setConversas((atual) =>
      atual.map((c) =>
        c.id !== pendencia.conversaId
          ? c
          : {
              ...c,
              mensagens: c.mensagens.map((m) =>
                m.id === pendencia.msgId
                  ? {
                      ...m,
                      status: "stopped",
                      content: "Resposta interrompida por você.",
                    }
                  : m,
              ),
            },
      ),
    );
    toast({
      title: "Resposta interrompida",
      detail: "Nada foi gravado no ledger — o chat não altera estado de brief.",
    });
  }, [pendencia, toast]);

  function enviar() {
    const texto = entrada.trim();
    // Anexo sozinho é mensagem válida: "olha este arquivo" dispensa legenda.
    if (!texto && anexos.length === 0) return;
    // Uma resposta por vez: enfileirar duas produziria bolhas fora de ordem.
    if (pendente) {
      toast({
        tone: "danger",
        title: "Uma resposta em curso",
        detail: "Interrompa a resposta atual antes de enviar outra pergunta.",
      });
      return;
    }

    const agora = new Date().toISOString();
    const mensagem: Mensagem = {
      id: `u${Date.now()}`,
      role: "user",
      content: texto,
      anexos: anexos.length ? anexos : undefined,
      ts: agora,
    };

    atualizar(conversa.id, (c) => ({
      ...c,
      // O título sai da primeira pergunta — ninguém deveria batizar conversa
      // antes de saber sobre o que ela é. Depois disso, só renomeando à mão.
      titulo:
        c.mensagens.length === 0
          ? (() => {
              const base = texto || anexos[0].nome;
              return base.length > 46 ? `${base.slice(0, 46).trim()}…` : base;
            })()
          : c.titulo,
      atualizado_em: agora,
      mensagens: [...c.mensagens, mensagem],
    }));

    setAnexos([]);
    setErroAnexo(null);
    setEntrada("");
    if (entradaRef.current) entradaRef.current.style.height = "";
    responder(conversa.id);
  }

  /* ── teclado e cliques fora ───────────────────────────────────────────── */
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // Esc só interrompe quando não há modal aberto: lá o Esc é do modal.
      if (event.key === "Escape" && pendencia && !renomeando && !excluindo) {
        if (menuAberto) return;
        parar();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [excluindo, menuAberto, parar, pendencia, renomeando]);

  useEffect(() => {
    if (!menuAberto) return;
    function onDown(event: PointerEvent) {
      const alvo = event.target as Node;
      if (
        menuRef.current?.contains(alvo) ||
        maisRef.current?.contains(alvo) ||
        resumoRef.current?.contains(alvo)
      ) {
        return;
      }
      setMenuAberto(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menuAberto]);

  const agora = new Date(agoraIso).getTime();
  const ordenadas = [...conversas].sort((a, b) =>
    b.atualizado_em.localeCompare(a.atualizado_em),
  );

  function removerConversa(alvo: Conversa) {
    const indice = conversas.indexOf(alvo);
    setConversas((atual) => {
      const proximo = atual.filter((c) => c.id !== alvo.id);
      if (proximo.length === 0) {
        proximo.push({
          id: `n${Date.now()}`,
          titulo: "Nova conversa",
          atualizado_em: new Date().toISOString(),
          mensagens: [],
        });
      }
      if (ativa === alvo.id)
        setAtiva(proximo[Math.min(indice, proximo.length - 1)].id);
      return proximo;
    });
    toast({
      tone: "ok",
      title: "Conversa excluída",
      detail: `“${alvo.titulo}” saiu da lista.`,
      // As mensagens não existem em nenhum outro lugar: o desfazer é a única chance.
      undo: () => {
        setConversas((atual) => {
          const proximo = [...atual];
          proximo.splice(indice, 0, alvo);
          return proximo;
        });
        setAtiva(alvo.id);
      },
    });
  }

  const bloqueiaAnexo = pendente || anexos.length >= MAX_ARQUIVOS;

  return (
    <div className="grid-main chat-page">
      <section
        className={`panel chat-shell${arrastando ? " is-dropping" : ""}`}
        style={{ position: "relative" }}
        onDragEnter={(event) => {
          if (!Array.from(event.dataTransfer.types).includes("Files")) return;
          event.preventDefault();
          setArrastando(true);
        }}
        onDragOver={(event) => {
          if (!Array.from(event.dataTransfer.types).includes("Files")) return;
          event.preventDefault();
        }}
        // `dragleave` dispara ao passar por elementos filhos: só conta a saída
        // que realmente deixa o painel.
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null))
            return;
          setArrastando(false);
        }}
        onDrop={(event) => {
          if (!event.dataTransfer.files.length) return;
          event.preventDefault();
          setArrastando(false);
          adicionar(event.dataTransfer.files);
          entradaRef.current?.focus();
        }}
      >
        <p className="drop-hint">Solte para anexar à mensagem</p>
        <div className="disconnected-banner">
          <span>
            <IconPlug />
          </span>
          <span>
            Desconectado — nenhum endpoint de chat configurado. As respostas
            abaixo são exemplos estáticos do formato esperado.
          </span>
        </div>

        <div
          className="chat-log"
          ref={logRef}
          role="log"
          aria-live="polite"
          aria-label="Conversa com o agente"
        >
          {conversa.mensagens.length === 0 ? (
            <EmptyState
              title="Conversa nova"
              body="Faça a primeira pergunta e o título desta conversa passa a sair dela. O histórico vive na sessão do navegador — o ledger continua sendo a única memória durável."
            />
          ) : (
            conversa.mensagens.map((m) => {
              if (m.role === "user") {
                return (
                  <div className="msg msg-user" key={m.id}>
                    <span className="msg-avatar" aria-hidden="true">
                      EU
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="msg-name">
                        Editor{" "}
                        <span className="meta" style={{ fontWeight: 400 }}>
                          {fmtDate(m.ts, true)}
                        </span>
                      </div>
                      {m.content && (
                        <div className="msg-body">
                          <ProsaInline texto={m.content} />
                        </div>
                      )}
                      {m.anexos && m.anexos.length > 0 && (
                        <div className="msg-anexos">
                          {m.anexos.map((a) => (
                            <AnexoChip anexo={a} key={a.id} />
                          ))}
                        </div>
                      )}
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
                      <div
                        className="alert alert-danger"
                        style={{ marginTop: 4 }}
                      >
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
                      {/* O carimbo fica na resposta que ele produziu — é o que
                          permite comparar duas saídas da mesma pergunta. */}
                      {m.modelo && (
                        <span className="meta" style={{ fontWeight: 400 }}>
                          {" · "}
                          {rotuloModelo(m.modelo)} · esforço{" "}
                          {rotuloEsforco(m.esforco ?? "")}
                        </span>
                      )}
                    </div>
                    {m.tool && (
                      <div className="msg-tool">
                        <IconTool /> {m.tool.name}({JSON.stringify(m.tool.args)}
                        )
                      </div>
                    )}
                    <div
                      className="msg-body"
                      style={{ marginTop: m.tool ? 8 : 0 }}
                    >
                      {m.status === "streaming" ? (
                        <span
                          className="thinking"
                          aria-label="O agente está pensando"
                        >
                          <i />
                          <i />
                          <i />
                        </span>
                      ) : m.status === "stopped" ? (
                        <p className="small muted">
                          <IconStop /> {m.content}
                        </p>
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
          className="chat-composer pop-anchor"
          onSubmit={(event) => {
            event.preventDefault();
            enviar();
          }}
        >
          {menuAberto && (
            <div
              className="popover"
              role="menu"
              aria-label="Anexos, modelo e esforço"
              ref={menuRef}
            >
              <button
                className="menu-item"
                type="button"
                role="menuitem"
                disabled={bloqueiaAnexo}
                onClick={() => {
                  setMenuAberto(false);
                  arquivoRef.current?.click();
                }}
              >
                <IconClip />
                <span>Anexar arquivo</span>
                <span className="menu-hint">
                  {pendente
                    ? "Espere a resposta terminar."
                    : anexos.length >= MAX_ARQUIVOS
                      ? `Limite de ${MAX_ARQUIVOS} arquivos já atingido.`
                      : `Até ${MAX_ARQUIVOS} arquivos, ${MAX_MB} MB cada. Arrastar para a conversa também funciona.`}
                </span>
              </button>
              <hr className="menu-sep" />
              <p className="menu-label">Modelo</p>
              {CHAT_MODELOS.map((m) => (
                <button
                  className="menu-item"
                  type="button"
                  role="menuitemradio"
                  aria-checked={m.id === modelo}
                  key={m.id}
                  onClick={() => {
                    gravarModelo(m.id as ModeloId);
                    setMenuAberto(false);
                    maisRef.current?.focus();
                  }}
                >
                  <span className="menu-check">
                    <IconCheck />
                  </span>
                  <span>{m.label}</span>
                  <span className="menu-hint">{m.nota}</span>
                </button>
              ))}
              <hr className="menu-sep" />
              <p className="menu-label">Esforço de raciocínio</p>
              {CHAT_ESFORCOS.map((e) => (
                <button
                  className="menu-item"
                  type="button"
                  role="menuitemradio"
                  aria-checked={e.id === esforco}
                  key={e.id}
                  onClick={() => {
                    gravarEsforco(e.id as EsforcoId);
                    setMenuAberto(false);
                    maisRef.current?.focus();
                  }}
                >
                  <span className="menu-check">
                    <IconCheck />
                  </span>
                  <span>{e.label}</span>
                </button>
              ))}
            </div>
          )}

          <div className="sugestoes">
            {SUGESTOES.map((sugestao) => (
              <button
                className="tag"
                type="button"
                key={sugestao}
                onClick={() => {
                  setEntrada(sugestao);
                  entradaRef.current?.focus();
                }}
              >
                {sugestao}
              </button>
            ))}
          </div>

          <div className="attach-list">
            {anexos.map((anexo) => (
              <AnexoChip
                anexo={anexo}
                key={anexo.id}
                onRemover={() => {
                  if (anexo.url) URL.revokeObjectURL(anexo.url);
                  setAnexos((atual) => atual.filter((a) => a.id !== anexo.id));
                  setErroAnexo(null);
                }}
              />
            ))}
          </div>
          {erroAnexo && <p className="field-error">{erroAnexo}</p>}

          <div className="composer-row">
            <textarea
              className="textarea composer-input"
              ref={entradaRef}
              rows={1}
              placeholder="Pergunte sobre a fila, um brief ou a configuração…"
              aria-label="Mensagem para o agente"
              value={entrada}
              onChange={(event) => {
                setEntrada(event.target.value);
                // `auto` antes de medir, senão o scrollHeight nunca diminui
                // quando a pessoa apaga texto.
                const el = event.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(160, Math.max(52, el.scrollHeight))}px`;
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  enviar();
                }
              }}
            />
            <div className="row-tight" style={{ gap: 6 }}>
              <button
                className="btn btn-secondary btn-icon"
                type="button"
                ref={maisRef}
                style={{ height: 52, width: 46 }}
                aria-label="Anexos, modelo e esforço"
                title="Anexos, modelo e esforço"
                aria-haspopup="menu"
                aria-expanded={menuAberto}
                onClick={() => setMenuAberto((v) => !v)}
              >
                <IconPlus />
              </button>
              <button
                className="btn btn-primary"
                type="submit"
                style={{ height: 52 }}
                hidden={pendente}
              >
                Enviar
              </button>
              <button
                className="btn btn-danger"
                type="button"
                style={{ height: 52 }}
                hidden={!pendente}
                onClick={parar}
              >
                Parar
              </button>
            </div>
          </div>

          {/* O que está escolhido continua visível fora do menu: esconder a
              configuração ativa faria a pessoa perder a noção de com qual
              modelo a última resposta saiu. */}
          <div className="composer-meta">
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              ref={resumoRef}
              style={{ paddingInline: 6 }}
              aria-label="Trocar modelo e esforço"
              onClick={() => setMenuAberto((v) => !v)}
            >
              <IconSliders />
              <span>
                {rotuloModelo(modelo)} · esforço {rotuloEsforco(esforco)}
              </span>
            </button>
          </div>

          <input
            type="file"
            ref={arquivoRef}
            multiple
            hidden
            accept={ACCEPT}
            onChange={(event) => {
              adicionar(event.target.files ?? []);
              event.target.value = "";
            }}
          />

          <p className="field-help">
            {pendente
              ? "O agente está respondendo — Parar ou Esc interrompe. O que já chegou fica na conversa."
              : "Enter envia · Shift+Enter quebra linha · arraste arquivos para cá ou use o clipe. Sem backend, nada é enviado ao servidor — o anexo fica na sessão."}
          </p>
        </form>
      </section>

      <aside className="stack">
        <div className="panel">
          <div className="panel-head">
            <h2 className="h3">Conversas</h2>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() => {
                const nova: Conversa = {
                  id: `n${Date.now()}`,
                  titulo: "Nova conversa",
                  atualizado_em: new Date().toISOString(),
                  mensagens: [],
                };
                setConversas((atual) => [...atual, nova]);
                setAtiva(nova.id);
                entradaRef.current?.focus();
              }}
            >
              Nova
            </button>
          </div>
          <div className="conv-list" role="list">
            {ordenadas.map((c, i) => {
              const grupo = grupoDe(c.atualizado_em, agora);
              const anterior =
                i > 0 ? grupoDe(ordenadas[i - 1].atualizado_em, agora) : null;
              return (
                <div key={c.id} style={{ display: "contents" }}>
                  {grupo !== anterior && <p className="conv-group">{grupo}</p>}
                  <div
                    className="conv-item"
                    role="listitem"
                    aria-current={c.id === ativa}
                  >
                    <button
                      className="conv-open"
                      type="button"
                      onClick={() => setAtiva(c.id)}
                    >
                      <span className="conv-titulo">{c.titulo}</span>
                      <span className="conv-meta">{resumoDe(c)}</span>
                      <span className="conv-meta">
                        {fmtRelative(c.atualizado_em)} · {c.mensagens.length}{" "}
                        msg
                      </span>
                    </button>
                    <span className="conv-acoes">
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        type="button"
                        aria-label={`Renomear ${c.titulo}`}
                        title="Renomear"
                        onClick={() => {
                          setTituloDraft(c.titulo);
                          setTituloErro(false);
                          setRenomeando(c);
                        }}
                      >
                        <IconPencil />
                      </button>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        type="button"
                        aria-label={`Excluir ${c.titulo}`}
                        title="Excluir"
                        onClick={() => {
                          // Conversa vazia sai sem cerimônia; com histórico, confirma.
                          if (c.mensagens.length === 0) removerConversa(c);
                          else setExcluindo(c);
                        }}
                      >
                        <IconTrash />
                      </button>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2 className="h3">Contrato de props</h2>
          </div>
          <div className="panel-body" style={{ padding: 12 }}>
            <pre className="code">
              <span className="c-com">
                {"// components/chat/chat-client.tsx"}
              </span>
              {`
`}
              <span className="c-key">type</span> ChatMessage = {"{"}
              {`
  id: string
  role: `}
              <span className="c-key">&quot;user&quot;</span> |{" "}
              <span className="c-key">&quot;agent&quot;</span> |{" "}
              <span className="c-key">&quot;tool&quot;</span>
              {`
  content: string        `}
              <span className="c-com">{"// markdown"}</span>
              {`
  tool?: { name, args, result? }
  status?: `}
              <span className="c-key">&quot;streaming&quot;</span> |{" "}
              <span className="c-key">&quot;done&quot;</span>
              {`
           | `}
              <span className="c-key">&quot;error&quot;</span> |{" "}
              <span className="c-key">&quot;stopped&quot;</span>
              {`
  model?: string         `}
              <span className="c-com">{"// carimbo de quem respondeu"}</span>
              {`
  effort?: `}
              <span className="c-key">&quot;baixo&quot;</span> |{" "}
              <span className="c-key">&quot;medio&quot;</span> |{" "}
              <span className="c-key">&quot;alto&quot;</span>
              {`
  attachments?: Attachment[]
  ts: string
}

`}
              <span className="c-key">type</span> Attachment = {"{"}
              {`
  id, name, mime: string
  size: number           `}
              <span className="c-com">{"// bytes"}</span>
              {`
  url?: string           `}
              <span className="c-com">{"// preview local"}</span>
              {`
}

`}
              <span className="c-key">type</span> Conversation = {"{"}
              {`
  id: string
  title: string          `}
              <span className="c-com">{"// derivado da 1ª pergunta"}</span>
              {`
  updatedAt: string
  messages: ChatMessage[]
}

`}
              <span className="c-key">type</span> AgentChatProps = {"{"}
              {`
  conversations: Conversation[]
  activeId: string
  connected: boolean
  pending: boolean
  onSend: (text, files) => void
  accept: string
  maxFiles: number
  maxSizeMb: number
  models: { id, label, hint? }[]
  model: string
  effort: `}
              <span className="c-key">&quot;baixo&quot;</span> |{" "}
              <span className="c-key">&quot;medio&quot;</span> |{" "}
              <span className="c-key">&quot;alto&quot;</span>
              {`
  onModelChange: (id) => void
  onEffortChange: (e) => void
  onCancel: () => void   `}
              <span className="c-com">{"// botão Parar / Esc"}</span>
              {`
  onSelect: (id) => void
  onNew: () => void
  onRename: (id, title) => void
  onDelete: (id) => void
  error?: { code, message }
}`}
            </pre>
            <p className="field-help" style={{ marginTop: 12 }}>
              O backend futuro só precisa preencher isso. Nenhum estado do chat
              mora fora dessas props — a casca já é controlada.
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
              ["ok", "Mensagem com anexo", ""],
              ["ok", "Resposta interrompida", ""],
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
                atualizar(conversa.id, (c) => ({
                  ...c,
                  mensagens: [
                    ...c.mensagens,
                    {
                      id: `e${Date.now()}`,
                      role: "error",
                      code: "AGENT_UNAVAILABLE",
                      ts: new Date().toISOString(),
                      content:
                        "Nenhum endpoint de chat configurado em RADAR_AGENT_URL. A fila, o acervo e a configuração continuam funcionando normalmente — o chat é o único recurso afetado.",
                    },
                  ],
                }))
              }
            >
              Ver o estado de erro
            </button>
          </div>
        </div>
      </aside>

      <Modal
        open={renomeando !== null}
        onClose={() => setRenomeando(null)}
        eyebrow={`${renomeando?.mensagens.length ?? 0} mensagem(ns)`}
        title="Renomear conversa"
        footer={
          <>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setRenomeando(null)}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                const valor = tituloDraft.trim();
                if (!valor) {
                  setTituloErro(true);
                  return;
                }
                if (renomeando)
                  atualizar(renomeando.id, (c) => ({ ...c, titulo: valor }));
                setRenomeando(null);
              }}
            >
              Salvar
            </button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="titulo-conversa">Título</label>
          <input
            className="input"
            id="titulo-conversa"
            data-autofocus
            maxLength={80}
            value={tituloDraft}
            onChange={(event) => {
              setTituloDraft(event.target.value);
              setTituloErro(false);
            }}
          />
          {tituloErro && (
            <p className="field-error">O título não pode ficar vazio.</p>
          )}
        </div>
      </Modal>

      <Modal
        open={excluindo !== null}
        onClose={() => setExcluindo(null)}
        eyebrow={excluindo?.titulo}
        title="Excluir esta conversa?"
        footer={
          <>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setExcluindo(null)}
            >
              Cancelar
            </button>
            <button
              className="btn btn-danger"
              type="button"
              onClick={() => {
                if (excluindo) removerConversa(excluindo);
                setExcluindo(null);
              }}
            >
              <IconTrash />
              Excluir
            </button>
          </>
        }
      >
        <p className="small">
          São <strong>{excluindo?.mensagens.length} mensagens</strong>. O
          histórico do chat vive só na sessão do navegador, então não há de onde
          recuperar depois — o desfazer do aviso é a única chance.
        </p>
      </Modal>
    </div>
  );
}
