"use client";

import { useEffect, useState } from "react";
import { fmtRelative } from "@/lib/format";

/**
 * A varredura em voo, ao lado da conversa.
 *
 * Fica aqui porque é onde a pessoa pede: mandou o agente rodar e quer ver
 * acontecer. A execução leva de 12 a 63 minutos e roda noutro processo — o que
 * este painel resolve é a espera cega, mostrando estágio, tempo e o que cada
 * etapa já produziu.
 */

const ESTAGIOS = [
  ["pesquisa", "Pesquisa"],
  ["filtragem", "Filtragem"],
  ["redacao", "Redação"],
] as const;

interface Andamento {
  scanRef: string;
  estado: string;
  pedido: { escopo: string; pilar?: string; alvo?: number };
  pedidoEm: string;
  iniciadoEm: string | null;
  posicao: number | null;
  estagios: {
    estagio: string;
    minuto: number;
    extra: Record<string, unknown>;
  }[];
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
  const [scan, setScan] = useState<Andamento | null | undefined>(undefined);

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

  const vencidos = new Map(scan?.estagios.map((e) => [e.estagio, e]) ?? []);

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

            {scan.estado === "enfileirado" ? (
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
              {ESTAGIOS.map(([id, rotulo]) => {
                const vencido = vencidos.get(id);
                const corrente = scan.estado === id;
                const parciais = Object.entries(vencido?.extra ?? {})
                  .map(([k, v]) => `${v} ${ROTULO[k] ?? k}`)
                  .join(" · ");
                return (
                  <div className="row-tight" key={id}>
                    <span
                      className={`pill pill-bare ${
                        vencido ? "" : corrente ? "pill-accent" : "muted"
                      }`}
                    >
                      {vencido ? "✓" : corrente ? "agora" : "—"}
                    </span>
                    <span className="small">
                      {rotulo}
                      {vencido ? (
                        <span className="muted">
                          {" "}
                          · {vencido.minuto.toFixed(1).replace(".", ",")} min
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
