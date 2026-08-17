"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useVault } from "@/components/vault-provider";
import { EmptyState, Crumb } from "@/components/ui/pieces";
import { Prosa, ProsaInline } from "@/components/ui/prosa";
import { IconAlert, IconInfo, IconLock } from "@/components/ui/icons";
import { fmtRelative } from "@/lib/format";
import { CRITICIDADE, conteudoDe } from "@/lib/vault/blocos";

/**
 * Roteiro da entrevista: uma pergunta gera um bloco. As de apoio são as que o
 * agente faz até ter material — depois disso ele para de perguntar.
 */
const ROTEIRO: Record<string, { apoio: string[]; sugestoes: string[] }> = {
  identidade: {
    apoio: [
      "O que a marca faz que a concorrência não faz?",
      "De onde ela veio, e o que sobrou dessa origem?",
    ],
    sugestoes: [
      "Curadoria, não venda: organizamos a decisão",
      "Nasceu como marca pessoal e virou operação",
    ],
  },
  voz: {
    apoio: [
      "Me dá um exemplo de frase que soa como a marca — e uma que não soa.",
      "O que você nunca deixaria sair num post?",
    ],
    sugestoes: [
      "Frase curta, verbo no presente, número quando existe",
      "Nada de “oportunidade única” nem promessa de retorno",
    ],
  },
  guardrails: {
    apoio: [
      "Que erro seria grave a ponto de gerar problema jurídico?",
      "Como uma conversa boa termina?",
    ],
    sugestoes: [
      "Nunca prometer aprovação de crédito",
      "Sempre terminar com um próximo passo concreto",
    ],
  },
  foco: {
    apoio: [
      "Dá um exemplo de assunto que parece certo mas fica de fora.",
      "Como você decide na dúvida?",
    ],
    sugestoes: ["Entra o que muda a decisão de quem compra", "Fica de fora leilão e alto padrão pronto"],
  },
  publicos: {
    apoio: [
      "Como cada um desses decide — pelo número ou pela sensação?",
      "Onde cada um costuma travar?",
    ],
    sugestoes: [
      "Investidor de lote, família do programa popular, quem busca sítio",
      "O investidor quer número; a família quer segurança",
    ],
  },
  pilares: {
    apoio: [
      "Dos assuntos que sobraram, quais a marca sustenta toda semana?",
      "Qual a proporção entre eles numa semana normal?",
    ],
    sugestoes: [
      "Oportunidade, educação financeira, região e bastidores",
      "2 de oportunidade, 1 de cada um dos outros",
    ],
  },
  temas: {
    apoio: [
      "Que assunto já apareceu mais de uma vez e merece código próprio?",
      "A que pilar cada um pertence?",
    ],
    sugestoes: [
      "Módulo mínimo, outorga de água e teto de renda",
      "Começa vazio — eu vou propondo conforme aprovar",
    ],
  },
  visual: {
    apoio: ["Que sensação a arte precisa passar?", "Tem algo que a marca nunca usa visualmente?"],
    sugestoes: ["Sóbria, fria, sem gradiente", "Número sempre em mono tabular"],
  },
};

interface Mensagem {
  role: "user" | "agent";
  content: string;
}

export function VaultBloco({ chave }: { chave: string }) {
  const router = useRouter();
  const toast = useToast();
  const { mapa, aceitos, aceitar } = useVault();
  const logRef = useRef<HTMLDivElement>(null);

  const bloco = mapa.find((b) => b.key === chave);
  const roteiro = ROTEIRO[chave] ?? { apoio: [], sugestoes: [] };

  const [conversa, setConversa] = useState<Mensagem[]>([]);
  const [passo, setPasso] = useState(0);
  const [proposta, setProposta] = useState<string | null>(null);
  const [pensando, setPensando] = useState(false);
  const [entrada, setEntrada] = useState("");
  const [motivoAberto, setMotivoAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [motivoErro, setMotivoErro] = useState(false);

  // A abertura é derivada do bloco, não guardada: reabrir um bloco já
  // preenchido muda a primeira fala, e ela precisa acompanhar.
  const abertura = !bloco
    ? ""
    : bloco.preenchido
      ? `Este bloco já tem a versão **v${bloco.versao}**. Vou reabrir a mesma pergunta e você me diz o que mudou — o que existe hoje continua valendo até você aceitar uma versão nova.\n\n${bloco.pergunta ?? ""}`
      : bloco.pergunta ?? "Vamos definir este bloco.";
  const mensagens: Mensagem[] = [{ role: "agent", content: abertura }, ...conversa];

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [conversa, pensando]);

  if (!bloco || bloco.tipo === "config") {
    return (
      <div className="panel">
        <div className="panel-body">
          <EmptyState
            title={bloco ? "Esta etapa não é um bloco de vault" : "Bloco não encontrado"}
            body={
              bloco
                ? "Fontes e ajustes numéricos são trabalho manual acumulado, sem origem na marca. Eles vivem no manifest."
                : "Nenhum bloco com esta chave. Ele pode ter sido renomeado."
            }
            action={
              <Link className="btn btn-secondary" href={bloco?.href ?? "/config/vault"}>
                {bloco ? "Abrir configuração" : "Voltar ao vault"}
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const respostas = conversa.filter((m) => m.role === "user").length;

  function responder() {
    setPensando(true);
    setTimeout(() => {
      setPensando(false);
      if (passo < roteiro.apoio.length) {
        setConversa((atual) => [...atual, { role: "agent", content: roteiro.apoio[passo] }]);
        setPasso((p) => p + 1);
      } else {
        setConversa((atual) => [
          ...atual,
          {
            role: "agent",
            content:
              "Acho que já tenho o suficiente. Posso montar o bloco para você ler — se não ficar bom, a gente continua daqui.",
          },
        ]);
      }
    }, 900);
  }

  function enviar() {
    const texto = entrada.trim();
    if (!texto) return;
    setConversa((atual) => [...atual, { role: "user", content: texto }]);
    setEntrada("");
    responder();
  }

  function gerar() {
    setPensando(true);
    setTimeout(() => {
      setPensando(false);
      setProposta(conteudoDe(aceitos, chave) ?? "");
      setConversa((atual) => [
        ...atual,
        {
          role: "agent",
          content:
            "Montei a versão ao lado. Leia com calma: é exatamente este texto que vai como contexto na varredura.",
        },
      ]);
    }, 1100);
  }

  function aceitarProposta() {
    if (proposta === null || !bloco) return;
    // Prosa não tem invariante verificável: o motivo é a única rede.
    if (!bloco.preenchido) {
      aceitar(chave, proposta, null);
      toast({
        tone: "ok",
        title: `${bloco.titulo} · v1 aceita`,
        detail: "O bloco passou a existir. Reabrir a partir de agora gera versão nova.",
      });
      setTimeout(() => router.push("/config/vault"), 700);
      return;
    }
    setMotivo("");
    setMotivoErro(false);
    setMotivoAberto(true);
  }

  const atual = bloco.preenchido ? conteudoDe(aceitos, chave) : null;
  const mostra = proposta ?? atual;

  return (
    <>
      <div className="page-head">
        <div className="row-between">
          <Crumb
            items={[
              { label: "Painel", href: "/" },
              { label: "Configuração", href: "/config" },
              { label: "Vault", href: "/config/vault" },
              { label: bloco.titulo },
            ]}
            back={{ href: "/config/vault", destino: "Vault" }}
          />
          <span className="eyebrow">{bloco.key}</span>
        </div>
        <div className="row-between" style={{ marginTop: 12, alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 420px", minWidth: 0 }}>
            <div className="row-tight" style={{ marginBottom: 10 }}>
              <span className={`pill ${bloco.criticidade === "obrigatorio" ? "pill-warn" : ""}`}>
                {CRITICIDADE[bloco.criticidade]}
              </span>
              {bloco.temId && <span className="tag">blocos com id</span>}
              {bloco.preenchido && bloco.atualizado_em && (
                <span className="meta">
                  v{bloco.versao} · {fmtRelative(bloco.atualizado_em)}
                </span>
              )}
            </div>
            <h1 className="display">{bloco.titulo}</h1>
            {bloco.pergunta && (
              <p className="lead" style={{ marginTop: 12 }}>
                {bloco.pergunta}
              </p>
            )}
          </div>
        </div>
      </div>

      {bloco.trancado && bloco.bloqueador ? (
        <div className="alert alert-warning" style={{ marginBottom: 20 }}>
          <IconLock />
          <div className="alert-body">
            <strong>Ainda não é hora deste bloco</strong>
            <p className="small" style={{ marginTop: 3 }}>
              Ele consome o que sai de <strong>{bloco.bloqueador.titulo}</strong> — sem aquilo, a
              conversa aqui não teria de onde partir.
            </p>
            <p style={{ marginTop: 9 }}>
              <Link
                className="btn btn-secondary btn-sm"
                href={`/config/vault/${bloco.bloqueador.key}`}
              >
                Ir para {bloco.bloqueador.titulo}
              </Link>
            </p>
          </div>
        </div>
      ) : (
        <div className="etapa">
          <section className="panel chat-shell">
            <div className="panel-head">
              <h2 className="h3">Entrevista</h2>
              <span className="meta">{respostas} resposta(s)</span>
            </div>
            <div
              className="chat-log"
              ref={logRef}
              role="log"
              aria-live="polite"
              aria-label="Conversa da etapa"
            >
              {mensagens.map((m, i) => (
                <div className={`msg ${m.role === "user" ? "msg-user" : "msg-agent"}`} key={i}>
                  <span className="msg-avatar" aria-hidden="true">
                    {m.role === "user" ? "EU" : "CR"}
                  </span>
                  <div>
                    <div className="msg-name">
                      {m.role === "user" ? "Editor" : "Agente do vault"}
                    </div>
                    <div className="msg-body">
                      <ProsaInline texto={m.content} />
                    </div>
                  </div>
                </div>
              ))}
              {pensando && (
                <div className="msg msg-agent">
                  <span className="msg-avatar" aria-hidden="true">
                    CR
                  </span>
                  <div>
                    <div className="msg-name">Agente do vault</div>
                    <div className="msg-body">
                      <span className="thinking">
                        <i />
                        <i />
                        <i />
                      </span>
                    </div>
                  </div>
                </div>
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
                {roteiro.sugestoes.map((sugestao) => (
                  <button
                    className="tag"
                    type="button"
                    key={sugestao}
                    onClick={() => {
                      setConversa((a) => [...a, { role: "user", content: sugestao }]);
                      responder();
                    }}
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
                  placeholder="Responda com suas palavras — o agente redige depois"
                  aria-label="Sua resposta"
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
              <p className="field-help">Enter envia · Shift+Enter quebra linha</p>
            </form>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2 className="h3">
                {proposta !== null ? "Versão gerada" : bloco.preenchido ? "Versão em vigor" : "Versão"}
              </h2>
              {proposta !== null ? (
                <span className="pill pill-warn">proposta · não aceita</span>
              ) : bloco.preenchido ? (
                <span className="pill pill-ok">v{bloco.versao} em vigor</span>
              ) : null}
            </div>
            <div className="panel-body">
              {bloco.temId && mostra && (
                <div className="alert" style={{ marginBottom: 16 }}>
                  <IconInfo />
                  <div className="alert-body">
                    <strong>Os códigos em mono são endereços</strong>
                    <p className="small" style={{ marginTop: 3 }}>
                      A configuração e os briefs apontam para eles. Reescrever o texto ao lado é
                      seguro; trocar o código quebra a referência.
                    </p>
                  </div>
                </div>
              )}
              {mostra ? (
                <Prosa texto={mostra} />
              ) : (
                <p className="small muted">
                  Nada gerado ainda. Responda o que o agente perguntar e clique em{" "}
                  <span className="strong">Gerar versão</span> quando quiser ver o bloco montado.
                </p>
              )}
            </div>
            <div
              className="panel-body"
              style={{
                borderTop: "1px solid var(--border)",
                display: "flex",
                gap: "var(--gap-xs)",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              {proposta !== null ? (
                <>
                  <button className="btn btn-ok" type="button" onClick={aceitarProposta}>
                    Aceitar{bloco.preenchido ? ` como v${bloco.versao + 1}` : " e seguir"}
                  </button>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => {
                      setProposta(null);
                      setConversa((a) => [
                        ...a,
                        { role: "agent", content: "Certo. O que ficou fora, ou o que eu entendi errado?" },
                      ]);
                    }}
                  >
                    Continuar conversando
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={respostas === 0}
                    onClick={gerar}
                  >
                    Gerar versão
                  </button>
                  {!bloco.preenchido && (
                    <span className="field-help">Precisa de pelo menos uma resposta.</span>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      )}

      <Modal
        open={motivoAberto}
        onClose={() => setMotivoAberto(false)}
        eyebrow={bloco.key}
        title="Por que este bloco está mudando?"
        footer={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setMotivoAberto(false)}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                if (!motivo.trim()) {
                  setMotivoErro(true);
                  return;
                }
                aceitar(chave, proposta, motivo.trim());
                setMotivoAberto(false);
                toast({
                  tone: "ok",
                  title: `${bloco.titulo} · v${bloco.versao + 1} aceita`,
                  detail: "A próxima varredura já roda contra esta versão.",
                });
                setTimeout(() => router.push("/config/vault"), 700);
              }}
            >
              Aceitar como v{bloco.versao + 1}
            </button>
          </>
        }
      >
        <p className="small">
          Não há validação possível para prosa — o motivo é o que permite entender depois por que a
          saída da varredura mudou de tom.
        </p>
        <div className="field" style={{ marginTop: 16 }}>
          <label htmlFor="motivo-bloco">
            Motivo <span className="muted">— vai para o histórico do bloco</span>
          </label>
          <textarea
            className="textarea"
            id="motivo-bloco"
            data-autofocus
            value={motivo}
            onChange={(event) => {
              setMotivo(event.target.value);
              setMotivoErro(false);
            }}
            placeholder="Ex.: o pilar de educação estava aceitando casa pronta fora do programa popular."
          />
          {motivoErro && (
            <p className="field-error">
              <IconAlert /> O motivo é obrigatório em toda alteração.
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
