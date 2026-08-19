"use client";

import Link from "next/link";
import { useVault } from "@/components/vault-provider";
import {
  IconAlert,
  IconCheck,
  IconLock,
  IconPencil,
} from "@/components/ui/icons";
import { fmtRelative } from "@/lib/format";
import { CRITICIDADE, ROTULO, type BlocoMapeado } from "@/lib/vault/blocos";

const PILL: Record<string, string> = {
  preenchido: "pill-ok",
  "pendente-obrigatorio": "pill-warn",
  trancado: "",
  "pendente-opcional": "",
};

function destinoDe(bloco: BlocoMapeado): string {
  if (bloco.trancado && bloco.bloqueador)
    return `/config/vault/${bloco.bloqueador.key}`;
  if (bloco.tipo === "config") return bloco.href ?? "/config";
  return `/config/vault/${bloco.key}`;
}

function Acao({ bloco }: { bloco: BlocoMapeado }) {
  if (bloco.trancado && bloco.bloqueador) {
    return (
      <Link className="btn btn-ghost btn-sm" href={destinoDe(bloco)}>
        Ir para {bloco.bloqueador.titulo} →
      </Link>
    );
  }
  if (bloco.tipo === "config") {
    return (
      <Link className="btn btn-secondary btn-sm" href={destinoDe(bloco)}>
        Abrir configuração
      </Link>
    );
  }
  if (bloco.preenchido) {
    return (
      <Link className="btn btn-secondary btn-sm" href={destinoDe(bloco)}>
        <IconPencil />
        Revisar
      </Link>
    );
  }
  return (
    <Link className="btn btn-primary btn-sm" href={destinoDe(bloco)}>
      Responder
    </Link>
  );
}

export function VaultMap() {
  const { mapa, progresso } = useVault();
  const pct = Math.round((progresso.preenchidos / progresso.total) * 100);
  const pctFalta = Math.round(
    (progresso.faltam.length / progresso.total) * 100,
  );

  return (
    <div className="grid-main">
      <div className="stack">
        <div className="panel">
          <div className="panel-body vault-progresso">
            <div className="row-between">
              <span className="field-label">Progresso</span>
              <span className="num small">
                <span className="strong">{progresso.preenchidos}</span> de{" "}
                {progresso.total} blocos
              </span>
            </div>
            <div
              className="vault-barra"
              role="img"
              aria-label={`${progresso.preenchidos} de ${progresso.total} blocos preenchidos, ${progresso.faltam.length} obrigatórios faltando`}
            >
              <i style={{ width: `${pct}%` }} />
              <i className="is-falta" style={{ width: `${pctFalta}%` }} />
            </div>
            <p
              className={`small ${progresso.podeRodar ? "" : "strong"}`}
              style={progresso.podeRodar ? undefined : { color: "var(--warn)" }}
            >
              {progresso.podeRodar
                ? "Todos os blocos obrigatórios estão preenchidos — a varredura roda."
                : `${progresso.faltam.length} bloco(s) obrigatório(s) faltando. Enquanto isso o pipeline não tem o que fazer.`}
            </p>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2 className="h3">Blocos</h2>
            <span className="meta">na ordem em que são montados</span>
          </div>
          <div className="panel-body-flush">
            {mapa.map((bloco, i) => (
              <article
                className={`bloco-card is-${bloco.estado}${bloco.trancado ? " is-trancado" : ""}`}
                key={bloco.key}
              >
                <span className="bloco-mark" aria-hidden="true">
                  {bloco.estado === "preenchido" ? (
                    <IconCheck />
                  ) : bloco.estado === "trancado" ? (
                    <IconLock />
                  ) : (
                    i + 1
                  )}
                </span>
                <div className="bloco-corpo">
                  <div className="row-tight" style={{ gap: 9 }}>
                    <h2 className="bloco-titulo">{bloco.titulo}</h2>
                    <span className="meta">{bloco.key}</span>
                    <span className={`pill ${PILL[bloco.estado]}`}>
                      {ROTULO[bloco.estado]}
                    </span>
                  </div>
                  <p className="small muted" style={{ marginTop: 5 }}>
                    {bloco.trancado && bloco.bloqueador ? (
                      <>
                        Precisa de{" "}
                        <span className="strong">
                          {bloco.bloqueador.titulo}
                        </span>{" "}
                        primeiro — esta etapa consome o que sai de lá.
                      </>
                    ) : (
                      bloco.resumo
                    )}
                  </p>
                  <div style={{ marginTop: 7 }}>
                    {bloco.preenchido && bloco.atualizado_em ? (
                      <span className="meta">
                        v{bloco.versao} · {fmtRelative(bloco.atualizado_em)}
                      </span>
                    ) : bloco.criticidade === "degrada" ? (
                      <span className="meta">
                        degrada sem — a copy sai correta e sem alma
                      </span>
                    ) : (
                      <span className="meta">
                        {CRITICIDADE[bloco.criticidade]}
                      </span>
                    )}
                  </div>
                </div>
                <div className="bloco-acao">
                  <Acao bloco={bloco} />
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="stack">
        <div className="panel">
          <div className="panel-head">
            <h2 className="h3">Estado do pipeline</h2>
          </div>
          <div className="panel-body">
            {progresso.podeRodar ? (
              <div
                className="alert"
                style={{
                  borderColor:
                    "color-mix(in oklch, var(--ok) 40%, transparent)",
                  background: "var(--ok-soft)",
                  color: "var(--ok)",
                }}
              >
                <IconCheck />
                <div className="alert-body">
                  <strong>Pronto para varrer</strong>
                  <p className="small" style={{ marginTop: 3 }}>
                    A próxima varredura usa a versão atual de cada bloco e
                    carimba qual foi.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="alert alert-warning">
                  <IconAlert />
                  <div className="alert-body">
                    <strong>Pipeline parado</strong>
                    <p className="small" style={{ marginTop: 3 }}>
                      Não é queda de qualidade: sem estes blocos não há o que
                      classificar nem onde procurar.
                    </p>
                  </div>
                </div>
                <div className="stack-sm" style={{ marginTop: 14 }}>
                  {progresso.faltam.map((bloco) => (
                    <Link
                      className="row-between"
                      href={destinoDe(bloco)}
                      key={bloco.key}
                    >
                      <span className="small strong">{bloco.titulo}</span>
                      <span className="meta">
                        {bloco.trancado ? "trancado" : "responder"}
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2 className="h3">Como ler os estados</h2>
          </div>
          <div className="panel-body stack-sm">
            {[
              [
                "pill-ok",
                "preenchido",
                "Tem versão aceita. Reabrir gera uma nova.",
              ],
              [
                "pill-warn",
                "falta para rodar",
                "Bloco obrigatório ainda vazio. É o que segura a varredura.",
              ],
              ["", "opcional", "Some do documento montado sem travar nada."],
              [
                "",
                "trancado",
                "Consome o que sai de outro bloco. Diz qual e leva até ele.",
              ],
            ].map(([cls, rotulo, texto]) => (
              <div key={rotulo}>
                <span className={`pill ${cls}`}>{rotulo}</span>
                <p className="small muted" style={{ marginTop: 5 }}>
                  {texto}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2 className="h3">Onde isso ainda mora</h2>
          </div>
          <div className="panel-body">
            <p className="small">
              Esta aba é casca: os blocos ficam no navegador, não no store. A
              persistência real está desenhada em{" "}
              <span className="num">docs/design-vault-onboarding.md</span>; hoje
              o vocabulário de verdade vem do vault da empresa em{" "}
              <span className="num">target_company.vault_path</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
