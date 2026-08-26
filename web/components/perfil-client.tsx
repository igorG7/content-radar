"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { sairAcao } from "@/app/login/acoes";
import { gravarNomeAcao } from "@/app/(shell)/perfil/acoes";
import { Crumb } from "@/components/ui/pieces";
import { IconLogout } from "@/components/ui/icons";
import { fmtDate } from "@/lib/format";
import {
  CHAT_ESFORCOS,
  CHAT_MODELOS,
  armazenamentoDisponivel,
  gravarEsforco,
  gravarModelo,
  useEsforco,
  useModelo,
  type EsforcoId,
  type ModeloId,
} from "@/lib/session";

export interface SessaoDoPerfil {
  email: string;
  ambiente: string;
  expiraEm: string;
  /** Do banco: é a conta que carrega o nome, não o navegador. */
  nome: string;
}

export function PerfilClient({ sessao }: { sessao: SessaoDoPerfil }) {
  const toast = useToast();
  const nome = sessao.nome;
  const modelo = useModelo();
  const esforco = useEsforco();

  // Rascunho do nome: `null` significa "igual ao gravado".
  const [rascunho, setRascunho] = useState<string | null>(null);
  const campo = rascunho ?? nome;
  const sujo = rascunho !== null && rascunho.trim() !== nome;

  const cabecalho = (
    <div className="row-between">
      <Crumb
        items={[{ label: "Painel", href: "/" }, { label: "Perfil" }]}
        back={{ href: "/", destino: "Painel" }}
      />
      <span className="eyebrow">sessão do navegador</span>
    </div>
  );

  return (
    <>
      <div className="page-head">
        {cabecalho}
        <div className="perfil-head" style={{ marginTop: 16 }}>
          <span className="perfil-mark" aria-hidden="true">
            {nome.charAt(0).toUpperCase()}
          </span>
          <div style={{ minWidth: 0 }}>
            <h1 className="display" style={{ lineHeight: 1.1 }}>
              {nome}
            </h1>
            <p className="lead" style={{ marginTop: 4 }}>
              {sessao.email}
            </p>
          </div>
        </div>
      </div>

      <div className="grid-main">
        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2 className="h3">Identidade</h2>
              <span className="meta">local a este navegador</span>
            </div>
            <div className="panel-body stack-sm">
              <div className="field">
                <label htmlFor="nome">Nome de exibição</label>
                <input
                  className="input"
                  id="nome"
                  maxLength={40}
                  value={campo}
                  placeholder="Como você aparece na barra"
                  onChange={(event) => setRascunho(event.target.value)}
                />
                <p className="field-help">
                  Aparece no canto da barra de navegação. Vazio, volta a usar o
                  que vem antes do @.
                </p>
              </div>
              <div className="field">
                <label htmlFor="email">E-mail</label>
                <input
                  className="input"
                  id="email"
                  value={sessao.email}
                  readOnly
                  style={{ fontFamily: "var(--font-mono)" }}
                />
                <p className="field-help">
                  É a chave da sessão. Trocar de e-mail é sair e entrar de novo
                  — sem backend, não há cadastro para alterar.
                </p>
              </div>
              <div className="row-tight" style={{ marginTop: 4 }}>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={async () => {
                    // Vazio é intenção válida: volta ao padrão derivado do e-mail.
                    const valor = campo.trim();
                    const dados = new FormData();
                    dados.set("nome", valor);
                    const r = await gravarNomeAcao({}, dados);
                    if (r.erro) {
                      toast({
                        tone: "danger",
                        title: "Não salvou",
                        detail: r.erro,
                      });
                      return;
                    }
                    setRascunho(null);
                    toast({
                      tone: "ok",
                      title: "Perfil salvo",
                      detail: valor
                        ? `A barra passa a mostrar “${valor}”.`
                        : "Voltou a usar o nome derivado do e-mail.",
                    });
                  }}
                >
                  Salvar
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => setRascunho(null)}
                >
                  Descartar
                </button>
                <span className="meta" aria-live="polite">
                  {sujo ? "alteração não salva" : ""}
                </span>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2 className="h3">Preferências</h2>
              <span className="meta">valem neste navegador</span>
            </div>
            <div className="panel-body stack-sm">
              <div className="row-between">
                <div>
                  <p className="field-label">Tema</p>
                  <p className="field-help" style={{ marginTop: 2 }}>
                    O mesmo botão da barra, com o estado por extenso.
                  </p>
                </div>
                <TemaSegmentado />
              </div>
              <hr className="rule" />
              <div className="row-between">
                <div>
                  <p className="field-label">Modelo padrão do chat</p>
                  <p className="field-help" style={{ marginTop: 2 }}>
                    {CHAT_MODELOS.find((m) => m.id === modelo)?.nota}
                  </p>
                </div>
                <select
                  className="select select-sm"
                  aria-label="Modelo padrão do chat"
                  style={{ width: "auto", minWidth: 130 }}
                  value={modelo}
                  onChange={(event) =>
                    gravarModelo(event.target.value as ModeloId)
                  }
                >
                  {CHAT_MODELOS.map((m) => (
                    <option value={m.id} key={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="row-between">
                <div>
                  <p className="field-label">Esforço padrão</p>
                  <p className="field-help" style={{ marginTop: 2 }}>
                    Quanto raciocínio pedir por resposta.
                  </p>
                </div>
                <select
                  className="select select-sm"
                  aria-label="Esforço padrão do chat"
                  style={{ width: "auto", minWidth: 130 }}
                  value={esforco}
                  onChange={(event) =>
                    gravarEsforco(event.target.value as EsforcoId)
                  }
                >
                  {CHAT_ESFORCOS.map((e) => (
                    <option value={e.id} key={e.id}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="field-help">
                O chat abre com estas escolhas — trocar lá também muda aqui.
              </p>
            </div>
          </section>
        </div>

        <div className="stack">
          <div className="panel">
            <div className="panel-head">
              <h2 className="h3">Sessão</h2>
            </div>
            <div className="panel-body">
              <dl className="kv">
                <dt>expira em</dt>
                <dd className="num">{fmtDate(sessao.expiraEm, true)}</dd>
                <dt>armazenamento</dt>
                <dd>
                  {armazenamentoDisponivel() ? (
                    "disponível — a sessão sobrevive ao recarregar"
                  ) : (
                    <span style={{ color: "var(--warn)" }}>
                      bloqueado — a sessão vale só nesta aba
                    </span>
                  )}
                </dd>
                <dt>papel</dt>
                <dd>editor — único papel do painel</dd>
              </dl>
              <hr className="rule" style={{ margin: "16px 0" }} />
              <button
                className="btn btn-danger"
                type="button"
                style={{ width: "100%" }}
                onClick={() => {
                  // O logout de verdade apaga o cookie no servidor e redireciona.
                  // O antigo limpava o navegador e a sessão seguia de pé.
                  toast({
                    tone: "ok",
                    title: "Sessão encerrada",
                    detail: "Voltando para o login.",
                  });
                  setTimeout(() => void sairAcao(), 700);
                }}
              >
                <IconLogout />
                Encerrar sessão
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2 className="h3">O que ainda não existe</h2>
            </div>
            <div className="panel-body stack-sm">
              {[
                [
                  "Senha e recuperação",
                  "Não há serviço de autenticação: o login aceita qualquer e-mail válido.",
                ],
                [
                  "Foto de avatar",
                  "A marca é a inicial do nome. Upload exigiria armazenamento de arquivo.",
                ],
                [
                  "Papéis e permissões",
                  "Todo mundo aprova, edita e configura. O handoff não definiu níveis de acesso.",
                ],
                [
                  "Notificações",
                  "Nada é enviado por e-mail ou push — a fila é o único lugar onde o trabalho aparece.",
                ],
              ].map(([titulo, detalhe]) => (
                <div key={titulo}>
                  <p className="small strong">{titulo}</p>
                  <p className="field-help" style={{ marginTop: 2 }}>
                    {detalhe}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** O tema mora no `data-theme` do <html>; aqui ele só ganha rótulo por extenso. */
function TemaSegmentado() {
  const [tema, setTema] = useState<"light" | "dark" | null>(null);
  const atual =
    tema ??
    (typeof document !== "undefined" &&
    document.documentElement.dataset.theme === "dark"
      ? "dark"
      : "light");

  function trocar(proximo: "light" | "dark") {
    if (proximo === "dark") document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem("radar-theme", proximo);
    } catch {
      /* modo privado */
    }
    setTema(proximo);
  }

  return (
    <div className="segmented" role="group" aria-label="Tema da interface">
      <button
        type="button"
        aria-pressed={atual === "light"}
        onClick={() => trocar("light")}
      >
        Claro
      </button>
      <button
        type="button"
        aria-pressed={atual === "dark"}
        onClick={() => trocar("dark")}
      >
        Escuro
      </button>
    </div>
  );
}
