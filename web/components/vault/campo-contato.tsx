"use client";

import { HANDLE_OK } from "@/lib/instagram";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Crumb } from "@/components/ui/pieces";
import {
  gravarContatoAcao,
  type EstadoContato,
} from "@/app/(shell)/config/vault/acoes";

/**
 * `contato` é bloco de tipo campo: continua sendo etapa dos primeiros passos e
 * exigência do pipeline, mas o conteúdo são valores, não prosa.
 *
 * O número que vai no rodapé da arte é injetado pela skill no briefing visual.
 * Pedi-lo numa caixa de texto livre convidaria a escrever "nosso WhatsApp é
 * (31) 9…" — e aí extrair o valor viraria adivinhação.
 */

export interface Contato {
  canalPrincipal: string;
  instagram: string | null;
  telefoneExibicao: string | null;
  telefoneE164: string | null;
  telefoneSecundarioE164: string | null;
}

const E164 = /^\+\d{11,15}$/;

/** `(31) 9 9077-4580` a partir de `+5531990774580`. */
function exibicaoDe(e164: string): string {
  const d = e164.replace(/\D/g, "");
  if (d.length < 12) return e164;
  const ddd = d.slice(2, 4);
  const resto = d.slice(4);
  return resto.length === 9
    ? `(${ddd}) ${resto[0]} ${resto.slice(1, 5)}-${resto.slice(5)}`
    : `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
}

export function CampoContato({ atual }: { atual: Contato | null }) {
  const [estado, gravar, gravando] = useActionState<EstadoContato, FormData>(
    gravarContatoAcao,
    {},
  );

  const [canal, setCanal] = useState(atual?.canalPrincipal ?? "WhatsApp");
  const [instagram, setInstagram] = useState(atual?.instagram ?? "");
  const [principal, setPrincipal] = useState(atual?.telefoneE164 ?? "");
  const [secundario, setSecundario] = useState(
    atual?.telefoneSecundarioE164 ?? "",
  );

  const principalOk = E164.test(principal);
  const secundarioOk = secundario === "" || E164.test(secundario);

  return (
    <>
      <div className="page-head">
        <Crumb
          items={[
            { label: "Painel", href: "/" },
            { label: "Configuração", href: "/config" },
            { label: "Vault", href: "/config/vault" },
            { label: "Contato e CTA" },
          ]}
          back={{ href: "/config/vault", destino: "Vault" }}
        />
        <h1 className="display" style={{ marginTop: 12 }}>
          Contato e CTA
        </h1>
        <p className="lead" style={{ marginTop: 8 }}>
          Qual número aparece na arte, e para onde o post manda a pessoa. São
          valores, não texto: a arte recebe o número no rodapé e o CTA aponta
          para o canal.
        </p>
      </div>

      <div className="grid-main">
        <form className="panel" action={gravar}>
          <div className="panel-head">
            <h2 className="h3">Os valores</h2>
          </div>
          <div className="panel-body stack-sm">
            <div className="field">
              <label htmlFor="canal">Canal principal</label>
              <select
                className="select"
                id="canal"
                name="canalPrincipal"
                value={canal}
                onChange={(e) => setCanal(e.target.value)}
              >
                <option>WhatsApp</option>
                <option>Instagram Direct</option>
                <option>Telefone</option>
                <option>E-mail</option>
              </select>
              <p className="field-help">
                Para onde todo CTA aponta. Trocar aqui muda o destino de todo
                post gerado a partir do próximo scan.
              </p>
            </div>

            <div
              className={`field ${instagram && !HANDLE_OK.test(instagram) ? "field-invalid" : ""}`}
            >
              <label htmlFor="instagram">@ do Instagram</label>
              <input
                className="input"
                id="instagram"
                name="instagram"
                placeholder="avanzimoveis"
                spellCheck={false}
                value={instagram}
                onChange={(e) =>
                  setInstagram(e.target.value.replace(/^@+/, "").toLowerCase())
                }
              />
              <p className="field-help">
                Sem arroba. Aparece na prévia do feed, imitando o perfil da
                empresa — antes ficava no navegador, então cada máquina via um.
              </p>
            </div>

            <div
              className={`field ${principal && !principalOk ? "field-invalid" : ""}`}
            >
              <label htmlFor="principal">Número principal</label>
              <input
                className="input"
                id="principal"
                name="telefoneE164"
                inputMode="tel"
                placeholder="+5531990774580"
                style={{ fontFamily: "var(--font-mono)" }}
                value={principal}
                onChange={(e) =>
                  setPrincipal(e.target.value.replace(/\s/g, ""))
                }
              />
              <p className="field-help">
                Formato internacional. É a forma canônica — a de exibição sai
                dela:{" "}
                <span className="num">
                  {principalOk ? exibicaoDe(principal) : "—"}
                </span>
              </p>
              {principal && !principalOk && (
                <p className="field-error">
                  Precisa começar com <span className="num">+</span> e ter de 11
                  a 15 dígitos.
                </p>
              )}
            </div>

            <div
              className={`field ${secundario && !secundarioOk ? "field-invalid" : ""}`}
            >
              <label htmlFor="secundario">Número secundário</label>
              <input
                className="input"
                id="secundario"
                name="telefoneSecundarioE164"
                inputMode="tel"
                placeholder="opcional"
                style={{ fontFamily: "var(--font-mono)" }}
                value={secundario}
                onChange={(e) =>
                  setSecundario(e.target.value.replace(/\s/g, ""))
                }
              />
              <p className="field-help">
                Não vai para a arte — fica no registro da marca.
              </p>
            </div>

            {estado.erro && (
              <p className="field-error" role="alert">
                {estado.erro}
              </p>
            )}

            <div className="row-tight" style={{ marginTop: 4 }}>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={gravando || !principalOk || !secundarioOk}
              >
                {gravando ? "Gravando…" : atual ? "Salvar" : "Salvar e seguir"}
              </button>
              {estado.gravadoEm && !gravando && (
                <span className="meta" aria-live="polite">
                  gravado
                </span>
              )}
            </div>
          </div>
        </form>

        <div className="stack">
          <div className="panel">
            <div className="panel-head">
              <h2 className="h3">Onde isto aparece</h2>
            </div>
            <div className="panel-body stack-sm">
              <p className="small">
                O número de exibição entra no{" "}
                <span className="num">must_have</span> do briefing visual — é o
                que garante que a arte saia com o rodapé certo.
              </p>
              <hr className="rule" />
              <p className="small muted">
                O texto do CTA não fica aqui: ele é escrito pelo briefer, no tom
                de cada público. Este bloco define o destino, não a frase.
              </p>
              <p style={{ marginTop: 8 }}>
                <Link
                  className="btn btn-ghost btn-sm"
                  href="/config/vault/publicos"
                >
                  Ver os públicos →
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
