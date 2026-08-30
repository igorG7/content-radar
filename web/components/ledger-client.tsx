"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/pieces";
import { fmtDate, fmtRelative } from "@/lib/format";
import type { LedgerEvent } from "@/lib/store";
import { EVENT_TONE, eventLabel } from "@/lib/view/ledger-view";

export interface BriefRef {
  briefId: string;
  slug: string;
  state: string;
  headline: string;
}

/**
 * Um campo de `extra` como texto legível.
 *
 * `Array.prototype.join` num array de objetos devolve `[object Object]`, uma
 * vez por item — e foi assim que `recusas` chegou à tela. O registro guardava
 * o motivo da recusa e a exibição o destruía, no único lugar onde alguém iria
 * procurá-lo.
 *
 * Cada item é serializado por si: os primitivos como estão, os objetos como
 * JSON compacto. Quem lê prefere `{"onde":"slug","detalhe":"..."}` a um
 * marcador que não diz nada.
 */
export function textoDoExtra(valor: unknown): string {
  if (Array.isArray(valor)) return valor.map(textoDoExtra).join("  ·  ");
  if (valor !== null && typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
}

export function LedgerClient({
  eventos,
  briefs,
}: {
  eventos: LedgerEvent[];
  briefs: BriefRef[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [jsonlAberto, setJsonlAberto] = useState(false);

  const F = {
    brief: params.get("brief") ?? "",
    ator: params.get("ator") ?? "",
    tipo: params.get("tipo") ?? "",
  };

  const hrefWith = (overrides: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(overrides)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const porId = useMemo(
    () => new Map(briefs.map((b) => [b.briefId, b])),
    [briefs],
  );
  const atores = useMemo(
    () =>
      [
        ...new Set(
          eventos.map((e) => e.actor).filter((a): a is string => Boolean(a)),
        ),
      ].sort(),
    [eventos],
  );
  const tipos = useMemo(
    () => [...new Set(eventos.map((e) => e.event))].sort(),
    [eventos],
  );
  const briefsComEvento = useMemo(
    () =>
      [
        ...new Set(
          eventos
            .map((e) => e.brief_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ]
        .sort()
        .reverse(),
    [eventos],
  );

  const filtrados = eventos.filter((evento) => {
    if (F.brief && evento.brief_id !== F.brief) return false;
    if (F.ator && evento.actor !== F.ator) return false;
    if (F.tipo && evento.event !== F.tipo) return false;
    return true;
  });

  const grupoFiltro = (
    titulo: string,
    chave: string,
    opcoes: { v: string; l: string }[],
  ) => (
    <div className="filter-group" role="group" aria-label={titulo}>
      <span className="eyebrow" style={{ width: "100%" }}>
        {titulo}
      </span>
      {opcoes.map((o) => (
        <Link
          className="tag"
          key={`${chave}-${o.v}`}
          href={hrefWith({ [chave]: o.v })}
          aria-pressed={(F[chave as keyof typeof F] || "") === o.v}
          scroll={false}
        >
          {o.l}
        </Link>
      ))}
    </div>
  );

  return (
    <div className="grid-side">
      <aside className="panel" aria-label="Filtros do ledger">
        <div className="panel-head">
          <h2 className="h3">Filtros</h2>
          <Link className="btn btn-ghost btn-sm" href={pathname} scroll={false}>
            Limpar
          </Link>
        </div>
        <div className="panel-body filterbar">
          {grupoFiltro("Ator", "ator", [
            { v: "", l: "Todos" },
            ...atores.map((a) => ({ v: a, l: a })),
          ])}
          {grupoFiltro("Tipo de evento", "tipo", [
            { v: "", l: "Todos" },
            ...tipos.map((t) => ({ v: t, l: eventLabel(t) })),
          ])}
          <div className="field">
            <label className="field-label" htmlFor="brief-sel">
              Brief
            </label>
            <select
              className="select"
              id="brief-sel"
              value={F.brief}
              onChange={(event) =>
                router.replace(hrefWith({ brief: event.target.value }), {
                  scroll: false,
                })
              }
            >
              <option value="">Todos os briefs</option>
              {briefsComEvento.map((id) => (
                <option value={id} key={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>
          <p className="field-help">
            Atores seguem a convenção <span className="num">human:*</span>,{" "}
            <span className="num">skill:*</span>,{" "}
            <span className="num">agent:*</span> e{" "}
            <span className="num">app:radar-web</span> — dá para separar o que
            foi decisão humana do que foi automação.
          </p>
        </div>
      </aside>

      <section>
        <div className="row-between" style={{ marginBottom: 12 }}>
          <p className="meta" aria-live="polite">
            {filtrados.length} de {eventos.length} eventos
            {F.brief && ` · brief ${F.brief}`}
            {F.ator && ` · ator ${F.ator}`}
          </p>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={() => setJsonlAberto(true)}
          >
            Ver como JSONL
          </button>
        </div>

        <div className="panel">
          <div className="panel-body-flush">
            {filtrados.length === 0 ? (
              <EmptyState
                title="Nenhum evento neste recorte"
                body={`O ledger tem ${eventos.length} eventos; nenhum casa com os filtros atuais. Filtrar é só da tela — o ledger em si é append-only.`}
                action={
                  <Link
                    className="btn btn-secondary"
                    href={pathname}
                    scroll={false}
                  >
                    Limpar filtros
                  </Link>
                }
              />
            ) : (
              filtrados.map((evento, index) => {
                const brief = evento.brief_id
                  ? porId.get(evento.brief_id)
                  : undefined;
                const tone = EVENT_TONE[evento.event] ?? "";
                const extra = evento.extra ?? {};
                return (
                  <article className="ev-row" key={`${evento.ts}-${index}`}>
                    <div>
                      <div className="num small">
                        {fmtDate(evento.ts, true)}
                      </div>
                      <div className="meta" style={{ marginTop: 2 }}>
                        {fmtRelative(evento.ts)}
                      </div>
                    </div>
                    <div>
                      <span className={`ev-name ${tone ? `ev-${tone}` : ""}`}>
                        {eventLabel(evento.event)}
                      </span>
                      <div className="meta" style={{ marginTop: 4 }}>
                        {evento.event}
                      </div>
                      <div className="meta" style={{ marginTop: 6 }}>
                        {evento.actor ?? "—"}
                      </div>
                      {brief ? (
                        <Link
                          className="link small"
                          href={`/briefs/${brief.state}/${brief.slug}`}
                          style={{ display: "inline-block", marginTop: 6 }}
                        >
                          {evento.brief_id}
                        </Link>
                      ) : (
                        evento.brief_id && (
                          <span
                            className="meta"
                            style={{ display: "block", marginTop: 6 }}
                          >
                            {evento.brief_id}
                          </span>
                        )
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      {brief && (
                        <p
                          className="small strong clamp-2"
                          style={{ marginBottom: 8 }}
                        >
                          {brief.headline}
                        </p>
                      )}
                      {Object.keys(extra).length === 0 ? (
                        <span className="meta">sem campo extra</span>
                      ) : (
                        <div className="json-view">
                          {Object.entries(extra).map(([chave, valor]) => {
                            const texto = textoDoExtra(valor);
                            const ehUrl = texto.startsWith("http");
                            return (
                              <div className="json-row" key={chave}>
                                <span className="json-key">{chave}</span>
                                <span className="json-val">
                                  {ehUrl ? (
                                    <a
                                      className="link link-ext"
                                      href={texto}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      {texto}
                                    </a>
                                  ) : (
                                    texto
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </section>

      <Modal
        open={jsonlAberto}
        onClose={() => setJsonlAberto(false)}
        wide
        eyebrow="store/ledger.jsonl"
        title="Linhas cruas"
      >
        <p className="small">
          Uma linha por evento, sem vírgula entre elas, sem fechamento — por
          isso é seguro fazer append concorrente.
        </p>
        <pre
          className="code"
          style={{
            marginTop: 14,
            maxHeight: "52vh",
            overflow: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {filtrados.map((evento) => JSON.stringify(evento)).join("\n")}
        </pre>
      </Modal>
    </div>
  );
}
