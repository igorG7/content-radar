"use client";

import { useEffect, useState } from "react";
import { fmtRelative } from "@/lib/format";
import { linhasDeEstagio } from "@/lib/view/estagios";

/**
 * A varredura em voo, ao lado da conversa.
 *
 * Fica aqui porque é onde a pessoa pede: mandou o agente rodar e quer ver
 * acontecer. A execução leva de 12 a 63 minutos e roda noutro processo — o que
 * este painel resolve é a espera cega, mostrando estágio, tempo e o que cada
 * etapa já produziu.
 */

interface Varredura {
  scanRef: string;
  estado: string;
  emAndamento: boolean;
  pedido: { escopo: string; pilar?: string; alvo?: number };
  pedidoEm: string;
  iniciadoEm: string | null;
  encerradoEm: string | null;
  posicao: number | null;
  estagios: {
    estagio: string;
    minuto: number;
    extra: Record<string, unknown>;
  }[];
  resultado: {
    briefs: number;
    minutos: number | null;
    avisos: { onde: string; detalhe: string }[];
    erro: string | null;
  } | null;
}

/** Rótulos para a contagem parcial — chave crua na tela é vazamento do banco. */
const ROTULO: Record<string, string> = {
  achados: "achados",
  fontes_lidas: "fontes lidas",
  fontes_sem_resposta: "sem resposta",
  promovidos: "promovidos",
  descartados_score: "fora do corte",
  descartados_escopo: "fora de escopo",
  descartados_redundancia: "redundantes",
  briefs_escritos: "briefs",
  candidatas_baixadas: "imagens",
};

export function PainelVarredura() {
  const [scan, setScan] = useState<Varredura | null | undefined>(undefined);

  useEffect(() => {
    let vivo = true;

    async function consultar() {
      const r = await fetch("/api/scans").catch(() => null);
      if (!vivo || !r?.ok) return;
      const corpo = await r.json().catch(() => null);
      if (vivo) setScan(corpo?.scan ?? null);
    }

    void consultar();
    // Dez segundos: os estágios duram minutos, então perguntar mais rápido só
    // gastaria requisição sem mudar nada na tela.
    const timer = setInterval(consultar, 10_000);
    return () => {
      vivo = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="panel">
      <div className="panel-head">
        <h2 className="h3">Varredura</h2>
        {scan ? <span className="eyebrow">{scan.scanRef}</span> : null}
      </div>
      <div className="panel-body stack-sm">
        {scan === undefined ? (
          <p className="small muted">consultando…</p>
        ) : scan === null ? (
          <p className="small muted">
            Nenhuma em andamento. Peça uma na conversa — diga o escopo e, se
            quiser, o pilar.
          </p>
        ) : (
          <>
            <p className="small">
              <span className="num">{scan.pedido.escopo}</span>
              {scan.pedido.pilar
                ? ` · ${scan.pedido.pilar}`
                : " · todos os pilares"}
              {scan.pedido.alvo ? ` · alvo ${scan.pedido.alvo}` : ""}
            </p>

            {!scan.emAndamento ? (
              /* Terminada: o desfecho é o que interessa, e era justamente ele
                 que sumia da tela quando a varredura acabava. */
              <div className="stack-sm">
                <p className="small">
                  {scan.resultado?.erro ? (
                    <>
                      <span className="pill pill-bare pill-danger">falhou</span>{" "}
                      {scan.resultado.erro}
                    </>
                  ) : (
                    <>
                      {/* Sem ✓ quando não saiu pauta: a marca de sucesso ao lado
                          de "0 pautas" fazia a tela parecer comemorar o vazio. */}
                      <span
                        className={`pill pill-bare${scan.resultado?.briefs ? "" : " muted"}`}
                      >
                        {scan.resultado?.briefs ? "✓" : "—"}
                      </span>{" "}
                      {scan.resultado?.briefs
                        ? `${scan.resultado.briefs} ${scan.resultado.briefs === 1 ? "pauta" : "pautas"}`
                        : "terminou sem pauta"}
                      {scan.resultado?.minutos
                        ? ` em ${scan.resultado.minutos.toFixed(1).replace(".", ",")} min`
                        : ""}
                    </>
                  )}
                </p>
                {scan.resultado?.briefs ? (
                  <a className="btn btn-secondary btn-sm" href="/fila">
                    Ver na fila
                  </a>
                ) : null}
                {scan.resultado?.avisos.length ? (
                  <div className="stack-sm">
                    {/* Aviso é o que entrou incompleto. Fica aqui porque quem
                        aprova precisa saber antes de abrir o brief. */}
                    {scan.resultado.avisos.map((a) => (
                      <p className="small muted" key={`${a.onde}-${a.detalhe}`}>
                        ⚠ {a.detalhe}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : scan.estado === "enfileirado" ? (
              <p className="small">
                {/* Sem a posição, "iniciando" fica parado por minutos sem
                    explicação nenhuma. */}
                Esperando vaga
                {scan.posicao ? ` · ${scan.posicao}º na fila` : ""} · pedida{" "}
                {fmtRelative(scan.pedidoEm)}
              </p>
            ) : (
              <p className="small">
                Rodando desde {fmtRelative(scan.iniciadoEm ?? scan.pedidoEm)}
              </p>
            )}

            <div className="stack-sm" style={{ marginTop: 4 }}>
              {linhasDeEstagio(
                scan.estagios,
                scan.estado,
                !scan.emAndamento,
              ).map((l) => {
                const parciais = Object.entries(l.extra)
                  .map(([k, v]) => `${v} ${ROTULO[k] ?? k}`)
                  .join(" · ");
                const min = (n: number) =>
                  `${n.toFixed(1).replace(".", ",")} min`;

                return (
                  <div className="row-tight" key={l.id}>
                    <span
                      className={`pill pill-bare ${
                        l.situacao === "concluido"
                          ? ""
                          : l.situacao === "corrente"
                            ? "pill-accent"
                            : "muted"
                      }`}
                    >
                      {l.situacao === "concluido"
                        ? "✓"
                        : l.situacao === "corrente"
                          ? "agora"
                          : l.situacao === "nao-alcancado"
                            ? "×"
                            : "—"}
                    </span>
                    <span
                      className={
                        l.situacao === "nao-alcancado" ? "small muted" : "small"
                      }
                    >
                      {l.rotulo}
                      {l.situacao === "nao-alcancado" ? (
                        <span className="muted"> · não chegou a rodar</span>
                      ) : null}
                      {l.entrouEm !== null ? (
                        <span className="muted">
                          {" "}
                          ·{" "}
                          {l.duracao !== null
                            ? min(l.duracao)
                            : l.situacao === "corrente"
                              ? `desde ${min(l.entrouEm)}`
                              : `entrou aos ${min(l.entrouEm)}`}
                          {parciais ? ` · ${parciais}` : ""}
                        </span>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
