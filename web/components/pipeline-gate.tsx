"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useVault } from "@/components/vault-provider";
import { EmptyState } from "@/components/ui/pieces";
import { IconLock } from "@/components/ui/icons";

/**
 * Sem os blocos obrigatórios do vault não existe fila: a varredura não tem o
 * que classificar nem onde procurar. A tela diz isso em vez de mostrar
 * contador zerado, que pareceria defeito — e fila vazia por falta de vault não
 * é a mesma coisa que fila vazia por trabalho terminado.
 */
export function PipelineGate({ variant, children }: { variant: "painel" | "fila"; children: ReactNode }) {
  const { progresso } = useVault();

  if (progresso.podeRodar) return <>{children}</>;

  if (variant === "fila") {
    return (
      <div className="panel">
        <div className="panel-body">
          <EmptyState
            title="A varredura ainda não rodou"
            body={`A fila está vazia porque faltam ${progresso.faltam.length} bloco(s) obrigatório(s) do vault — sem pilar não há classificação, sem fonte não há o que pesquisar.`}
            action={
              <Link className="btn btn-primary" href="/config/vault">
                Continuar o vault
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <p className="eyebrow">primeiro acesso</p>
        <h1 className="display" style={{ marginTop: 8 }}>
          O pipeline ainda não rodou
        </h1>
        <p className="lead">
          Faltam {progresso.faltam.length} bloco(s) obrigatório(s) do vault. Não é queda de
          qualidade — sem eles a varredura não tem o que classificar nem onde procurar.
        </p>
      </div>

      <div className="grid-main">
        <div className="stack">
          <div className="panel">
            <div className="panel-head">
              <h2 className="h3">O que falta</h2>
              <span className="meta">
                {progresso.preenchidos} de {progresso.total} blocos preenchidos
              </span>
            </div>
            <div className="panel-body-flush">
              {progresso.faltam.map((bloco) => (
                <div className="bloco-card is-pendente-obrigatorio" key={bloco.key}>
                  <span className="bloco-mark" aria-hidden="true">
                    {bloco.trancado ? <IconLock /> : "!"}
                  </span>
                  <div className="bloco-corpo">
                    <div className="row-tight" style={{ gap: 9 }}>
                      <h3 className="bloco-titulo">{bloco.titulo}</h3>
                      <span className="meta">{bloco.key}</span>
                    </div>
                    <p className="small muted" style={{ marginTop: 5 }}>
                      {bloco.porque ?? bloco.resumo}
                    </p>
                    {bloco.trancado && bloco.bloqueador && (
                      <p className="meta" style={{ marginTop: 6 }}>
                        trancado por {bloco.bloqueador.titulo}
                      </p>
                    )}
                  </div>
                  <div className="bloco-acao">
                    <Link
                      className={`btn btn-${bloco.trancado ? "ghost" : "primary"} btn-sm`}
                      href={
                        bloco.trancado
                          ? `/config/vault/${bloco.bloqueador?.key}`
                          : bloco.tipo === "config"
                            ? bloco.href ?? "/config"
                            : `/config/vault/${bloco.key}`
                      }
                    >
                      {bloco.trancado
                        ? "Ir ao bloqueador"
                        : bloco.tipo === "config"
                          ? "Configurar"
                          : "Responder"}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p>
            <Link className="btn btn-secondary" href="/config/vault">
              Abrir o vault
            </Link>
          </p>
        </div>

        <div className="stack">
          <div className="panel">
            <div className="panel-head">
              <h2 className="h3">O que já dá para fazer</h2>
            </div>
            <div className="panel-body stack-sm">
              <p className="small">
                A ordem sai da dependência real, não de preferência. Blocos livres podem ser
                respondidos em qualquer sequência; os trancados esperam o insumo do anterior.
              </p>
              <hr className="rule" />
              <p className="small muted">
                Identidade e origem não trava nada — mas quem pula troca copy com alma por copy
                correta. Ela alimenta o posicionamento que entra em toda execução.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
