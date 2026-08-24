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
  IconPlus,
  IconSliders,
  IconStop,
  IconTool,
  IconTrash,
} from "@/components/ui/icons";
import { fmtDate, fmtRelative } from "@/lib/format";
import {
  ACCEPT,
  EXTENSOES,
  LIMITE_BYTES,
  MAX_ARQUIVOS,
  avaliar,
} from "@/lib/anexos";
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
import { type Conversa, type Mensagem } from "./exemplos";
import { PainelVarredura } from "./painel-varredura";

export interface Anexo {
  id: string;
  nome: string;
  tamanho: number;
  mime: string;
  /** Blob URL local, para a prévia. Some quando o anexo sai da lista. */
  url: string | null;
  /**
   * O arquivo em si, guardado até o envio. Sem ele o chip existia e o conteúdo
   * ficava no navegador — o anexo aparecia na tela e o agente respondia que não
   * tinha recebido nada.
   */
  arquivo?: File;
}

/**
 * As regras vêm de `lib/anexos`, compartilhadas com a rota. A lista daqui
 * anunciava PNG, JPEG, WebP e PDF — formatos que nada no caminho sabia ler, e
 * que faziam a pessoa anexar um PDF para ouvir do agente que não chegou nada.
 */

const SUGESTOES = [
  "Resuma a fila por pilar",
  "Quais briefs estão sem arte decidida?",
  "O que muda se eu subir o match_score_min?",
];

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

export function ChatClient({ agoraIso }: { agoraIso: string }) {
  const toast = useToast();
  const logRef = useRef<HTMLDivElement>(null);
  const entradaRef = useRef<HTMLTextAreaElement>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const maisRef = useRef<HTMLButtonElement>(null);
  const resumoRef = useRef<HTMLButtonElement>(null);
  // O aborto é detalhe de transporte e mora num ref; qual conversa está
  // esperando é estado, porque o composer troca Enviar por Parar por causa dele.
  const abortoRef = useRef<AbortController | null>(null);
  const [pendencia, setPendencia] = useState<{
    conversaId: string;
    msgId: string;
  } | null>(null);

  /**
   * As conversas vêm do banco. Antes viviam aqui e só aqui: recarregar a página
   * perdia o histórico e o ponteiro para a memória do agente junto.
   *
   * A lista chega sem mensagens — carregar o histórico de todas para desenhar a
   * barra lateral traria o ambiente inteiro a cada abertura. O corpo de cada uma
   * é buscado quando ela é aberta.
   */
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [ativa, setAtiva] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
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
    let vivo = true;
    (async () => {
      const r = await fetch("/api/conversas").catch(() => null);
      const corpo = await r?.json().catch(() => null);
      if (!vivo) return;

      const lista: Conversa[] = (corpo?.conversas ?? []).map(
        (c: { id: string; titulo: string; atualizadoEm: string }) => ({
          id: c.id,
          titulo: c.titulo,
          atualizado_em: c.atualizadoEm,
          mensagens: [],
        }),
      );

      // Sem nenhuma, abre uma nova — a tela nunca fica sem conversa ativa.
      if (lista.length === 0) {
        const nova = await criarNoServidor("Nova conversa");
        if (nova && vivo) {
          setConversas([nova]);
          setAtiva(nova.id);
        }
      } else {
        setConversas(lista);
        // Abrir, não só marcar como ativa: a lista chega sem mensagens, e
        // apenas selecionar deixaria a conversa mais recente parecendo vazia.
        await abrir(lista[0].id);
      }
      if (vivo) setCarregando(false);
    })();
    return () => {
      vivo = false;
    };
    // Uma vez ao montar: recarregar a lista a cada mudança apagaria o que a
    // conversa aberta acabou de receber.
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [conversa?.mensagens]);

  // Blob URLs vivem até serem revogadas; sem isto, cada anexo de imagem vaza.
  useEffect(() => {
    return () => {
      for (const anexo of anexos) if (anexo.url) URL.revokeObjectURL(anexo.url);
    };
  }, [anexos]);

  async function criarNoServidor(titulo: string): Promise<Conversa | null> {
    const r = await fetch("/api/conversas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ titulo }),
    }).catch(() => null);
    const c = await r?.json().catch(() => null);
    if (!r?.ok || !c?.id) return null;
    return {
      id: c.id,
      titulo: c.titulo,
      atualizado_em: c.atualizadoEm,
      mensagens: [],
    };
  }

  /** Abre a conversa, buscando o histórico dela — a lista vem sem mensagens. */
  async function abrir(id: string) {
    setAtiva(id);
    const r = await fetch(`/api/conversas/${id}`).catch(() => null);
    const c = await r?.json().catch(() => null);
    if (!r?.ok || !c?.id) return;
    setConversas((atual) =>
      atual.map((x) =>
        x.id !== id
          ? x
          : {
              ...x,
              mensagens: (c.mensagens ?? []).map(
                (m: {
                  id: number;
                  papel: string;
                  corpo: string;
                  ferramentas: string[];
                  modelo: string | null;
                  esforco: string | null;
                  ts: string;
                }) => ({
                  id: String(m.id),
                  role:
                    m.papel === "usuario"
                      ? "user"
                      : m.papel === "erro"
                        ? "error"
                        : "agent",
                  content: m.corpo,
                  ferramentas: m.ferramentas?.length
                    ? m.ferramentas
                    : undefined,
                  modelo: m.modelo ?? undefined,
                  esforco: m.esforco ?? undefined,
                  status: "done",
                  ts: m.ts,
                }),
              ),
            },
      ),
    );
  }

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
        const recusa = avaliar(f);
        if (recusa) {
          recusados.push(`${recusa.nome} — ${recusa.motivo}`);
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
          url: null,
          arquivo: f,
        });
      }
      return proximo;
    });
    // Recusa nomeia arquivo e motivo: "não deu" não diz o que corrigir.
    setErroAnexo(recusados.length ? recusados.join(" · ") : null);
  }, []);

  /* ── enviar, responder, interromper ───────────────────────────────────── */

  /**
   * Pergunta ao agente e vai preenchendo a bolha conforme a resposta chega.
   *
   * SSE e não uma resposta de uma vez: o agente consulta ferramentas antes de
   * escrever, e alguns segundos de silêncio parecem travamento. Os nomes das
   * consultas aparecem acima do texto enquanto acontecem.
   */
  async function responder(conversaId: string, pergunta: string) {
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

    const controle = new AbortController();
    abortoRef.current = controle;
    setPendencia({ conversaId, msgId });

    const alterarBolha = (mudanca: (m: Mensagem) => Mensagem) =>
      setConversas((atual) =>
        atual.map((c) =>
          c.id !== conversaId
            ? c
            : {
                ...c,
                mensagens: c.mensagens.map((m) =>
                  m.id === msgId ? mudanca(m) : m,
                ),
              },
        ),
      );

    try {
      const resposta = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controle.signal,
        body: JSON.stringify({
          mensagem: pergunta,
          conversaId,
          modelo,
          esforco,
        }),
      });

      if (!resposta.ok || !resposta.body) {
        const corpo = await resposta.json().catch(() => null);
        throw new Error(corpo?.error ?? `HTTP ${resposta.status}`);
      }

      const leitor = resposta.body.getReader();
      const decodificador = new TextDecoder();
      let sobra = "";

      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;
        sobra += decodificador.decode(value, { stream: true });

        // Um evento SSE termina em linha em branco. Sem juntar as sobras, um
        // JSON partido no meio do chunk viraria erro de parse.
        const partes = sobra.split("\n\n");
        sobra = partes.pop() ?? "";

        for (const parte of partes) {
          const linha = parte.split("\n").find((l) => l.startsWith("data: "));
          if (!linha) continue;
          const evento = JSON.parse(linha.slice(6));

          if (evento.tipo === "texto") {
            alterarBolha((m) => ({ ...m, content: m.content + evento.delta }));
          }
          if (evento.tipo === "ferramenta") {
            alterarBolha((m) => ({
              ...m,
              ferramentas: [...(m.ferramentas ?? []), evento.nome],
            }));
          }
          if (evento.tipo === "erro") {
            throw new Error(evento.mensagem);
          }
          if (evento.tipo === "fim" && evento.sessaoId) {
            atualizar(conversaId, (c) => ({
              ...c,
              sessaoAgente: evento.sessaoId,
            }));
          }
        }
      }

      alterarBolha((m) => ({ ...m, status: "done" }));
    } catch (erro) {
      // Aborto é decisão da pessoa, e `parar` já escreveu o que aconteceu na
      // bolha — tratar como falha sobrescreveria isso com um erro que não houve.
      if ((erro as Error).name === "AbortError") return;
      alterarBolha((m) => ({
        ...m,
        status: "done",
        role: "error",
        content: `Não consegui responder: ${(erro as Error).message}`,
      }));
      toast({
        tone: "danger",
        title: "Falha na conversa",
        detail: (erro as Error).message,
      });
    } finally {
      abortoRef.current = null;
      setPendencia(null);
    }
  }

  /**
   * Parar não apaga a bolha — deixa registrado que houve uma resposta
   * interrompida, e por quem.
   */
  const parar = useCallback(() => {
    if (!pendencia) return;
    abortoRef.current?.abort();
    abortoRef.current = null;
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
              const t =
                base.length > 46 ? `${base.slice(0, 46).trim()}…` : base;
              // Persiste também: o título sai da primeira pergunta, e sem isto
              // a lista voltaria a "Nova conversa" no próximo carregamento.
              void fetch(`/api/conversas/${c.id}`, {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ titulo: t }),
              });
              return t;
            })()
          : c.titulo,
      atualizado_em: agora,
      mensagens: [...c.mensagens, mensagem],
    }));

    const paraSubir = anexos;
    setAnexos([]);
    setErroAnexo(null);
    setEntrada("");
    if (entradaRef.current) entradaRef.current.style.height = "";

    /**
     * Os anexos sobem **antes** da pergunta.
     *
     * O agente lê o arquivo por ferramenta, e a ferramenta consulta a conversa:
     * se a pergunta chegasse primeiro, ele olharia uma conversa ainda sem o
     * anexo e responderia que não recebeu nada — que é exatamente o que
     * acontecia quando o arquivo não subia nunca.
     */
    void (async () => {
      for (const anexo of paraSubir) {
        if (!anexo.arquivo) continue;
        const form = new FormData();
        form.append("conversaId", conversa.id);
        form.append("arquivo", anexo.arquivo);
        const r = await fetch("/api/anexos", {
          method: "POST",
          body: form,
        }).catch(() => null);
        if (!r?.ok) {
          const corpo = await r?.json().catch(() => null);
          toast({
            tone: "danger",
            title: `Anexo não subiu · ${anexo.nome}`,
            detail: corpo?.error ?? "o agente não vai encontrá-lo",
          });
        }
      }
      await responder(conversa.id, texto);
    })();
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

  async function removerConversa(alvo: Conversa) {
    const indice = conversas.indexOf(alvo);
    await fetch(`/api/conversas/${alvo.id}`, { method: "DELETE" }).catch(
      () => null,
    );
    const reposicao =
      conversas.length === 1 ? await criarNoServidor("Nova conversa") : null;
    setConversas((atual) => {
      const proximo = atual.filter((c) => c.id !== alvo.id);
      if (proximo.length === 0 && reposicao) {
        proximo.push(reposicao);
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
        <div
          className="chat-log"
          ref={logRef}
          role="log"
          aria-live="polite"
          aria-label="Conversa com o agente"
        >
          {carregando ? (
            <EmptyState
              title="Carregando as conversas"
              body="Buscando o histórico deste ambiente."
            />
          ) : conversa.mensagens.length === 0 ? (
            <EmptyState
              title="Conversa nova"
              body="Faça a primeira pergunta e o título desta conversa passa a sair dela. O histórico fica gravado — recarregar a página não perde mais nada."
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
                    {/* O que foi consultado fica à vista: sem isso a resposta
                        parece adivinhação em vez de apuração. */}
                    {m.ferramentas?.length ? (
                      <div className="msg-tool">
                        <IconTool /> {m.ferramentas.join(" · ")}
                      </div>
                    ) : null}
                    <div
                      className="msg-body"
                      style={{ marginTop: m.ferramentas?.length ? 8 : 0 }}
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
                      : `Texto até ${Math.round(LIMITE_BYTES / 1000)} KB — ${EXTENSOES.join(", ")}. Arrastar também funciona.`}
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
              : "Enter envia · Shift+Enter quebra linha. Anexo de texto sobe com a mensagem — o agente lê quando precisar."}
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
              onClick={async () => {
                const nova = await criarNoServidor("Nova conversa");
                if (!nova) return;
                setConversas((atual) => [nova, ...atual]);
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
                      onClick={() => void abrir(c.id)}
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

        <PainelVarredura />
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
                if (renomeando) {
                  atualizar(renomeando.id, (c) => ({ ...c, titulo: valor }));
                  void fetch(`/api/conversas/${renomeando.id}`, {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ titulo: valor }),
                  });
                }
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
