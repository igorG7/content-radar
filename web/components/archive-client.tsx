"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PublishDialog } from "@/components/publish-dialog";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/pieces";
import { IconCheck, IconExternal, IconSearch } from "@/components/ui/icons";
import { fmtDate, fmtScore, weekLabel } from "@/lib/format";
import type { BriefState } from "@/lib/manifest";
import { STATE_META, dataRef, type BriefView } from "@/lib/view/brief-view";

const ESTADOS: BriefState[] = ["pendente-publicacao", "publicado", "rejeitado"];

const ROTULO_DATA: Record<string, string> = {
  "pendente-publicacao": "aprovado em",
  publicado: "publicado em",
  rejeitado: "rejeitado em",
};

export function ArchiveClient({
  briefs,
  janelas,
  agoraIso,
}: {
  briefs: BriefView[];
  janelas: number[];
  /** Instante da leitura do disco — o filtro de janela mede a partir dele. */
  agoraIso: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const [publicando, setPublicando] = useState<BriefView | null>(null);

  const F = {
    estado: (params.get("estado") as BriefState) ?? "pendente-publicacao",
    q: params.get("q") ?? "",
    pilar: params.get("pilar") ?? "",
    icp: params.get("icp") ?? "",
    periodo: params.get("periodo") ?? "",
    visao: params.get("visao") ?? "semana",
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

  const doEstado = useMemo(
    () => briefs.filter((b) => b.state === F.estado),
    [briefs, F.estado],
  );

  const pilares = useMemo(
    () =>
      [
        ...new Set(
          briefs.map((b) => b.pilar).filter((p): p is string => Boolean(p)),
        ),
      ].sort(),
    [briefs],
  );
  const icps = useMemo(
    () =>
      [
        ...new Set(
          briefs.map((b) => b.icp).filter((p): p is string => Boolean(p)),
        ),
      ].sort(),
    [briefs],
  );

  const lista = useMemo(() => {
    const agora = new Date(agoraIso).getTime();
    return doEstado
      .filter((b) => {
        if (F.pilar && b.pilar !== F.pilar) return false;
        if (F.icp && b.icp !== F.icp) return false;
        if (
          F.q &&
          !`${b.headline} ${b.hook} ${b.caption}`
            .toLowerCase()
            .includes(F.q.toLowerCase())
        )
          return false;
        if (F.periodo) {
          const ref = dataRef(b);
          if (!ref) return false;
          const dias = (agora - new Date(ref).getTime()) / 86400000;
          if (dias > Number(F.periodo)) return false;
        }
        return true;
      })
      .sort((a, b) => dataRef(b).localeCompare(dataRef(a)));
  }, [doEstado, F.pilar, F.icp, F.q, F.periodo, agoraIso]);

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

  const linha = (brief: BriefView) => (
    <article className="arch-row" key={brief.slug}>
      <div>
        <div className="meta">{brief.briefId}</div>
        <div className="num small" style={{ marginTop: 4 }}>
          {brief.matchScore === null ? "—" : fmtScore(brief.matchScore)}
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        <h3 className="brief-headline" style={{ fontSize: 17 }}>
          <Link href={`/briefs/${brief.state}/${brief.slug}`}>
            {brief.headline}
          </Link>
        </h3>
        <p className="brief-hook clamp-2">{brief.hook}</p>
        <div className="row-tight" style={{ marginTop: 8 }}>
          {brief.pilar && <span className="tag">{brief.pilar}</span>}
          {brief.icp && <span className="tag">{brief.icp}</span>}
          {brief.heroChoice === null && brief.heroChoiceDeclared && (
            <span className="tag">só tipografia</span>
          )}
          {brief.borderline && (
            <span className="pill pill-warn">borderline</span>
          )}
        </div>
        {brief.rejectReason && (
          <p className="small" style={{ marginTop: 8, color: "var(--danger)" }}>
            {brief.rejectReason}
          </p>
        )}
      </div>
      <div className="arch-actions">
        <span className="meta">
          {ROTULO_DATA[brief.state]}{" "}
          {dataRef(brief) ? fmtDate(dataRef(brief)) : "—"}
        </span>
        {brief.igPostUrl && (
          <a
            className="btn btn-secondary btn-sm"
            href={brief.igPostUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <IconExternal />
            Ver no Instagram
          </a>
        )}
        {brief.state === "pendente-publicacao" && (
          <button
            className="btn btn-ok btn-sm"
            type="button"
            onClick={() => setPublicando(brief)}
          >
            <IconCheck />
            Marcar publicado
          </button>
        )}
        <Link
          className="btn btn-secondary btn-sm"
          href={`/briefs/${brief.state}/${brief.slug}`}
        >
          Ver detalhes
        </Link>
      </div>
    </article>
  );

  const porSemana = () => {
    const semanas = new Map<string, BriefView[]>();
    for (const brief of lista) {
      const atual = semanas.get(brief.week) ?? [];
      atual.push(brief);
      semanas.set(brief.week, atual);
    }
    return [...semanas.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([semana, grupo]) => (
        <div key={semana}>
          <div className="week-head">
            <h3>{weekLabel(semana)}</h3>
            <span className="meta">
              {grupo.length} brief{grupo.length > 1 ? "s" : ""}
              <span className="dot-sep" />
              {[...new Set(grupo.map((b) => b.pilar ?? "sem pilar"))].join(
                " · ",
              )}
            </span>
          </div>
          {grupo.map(linha)}
        </div>
      ));
  };

  return (
    <>
      <div className="row-between" style={{ marginBottom: 18 }}>
        <div className="segmented" role="tablist" aria-label="Estado do brief">
          {ESTADOS.map((estado) => (
            <Link
              key={estado}
              href={hrefWith({ estado })}
              role="tab"
              aria-selected={F.estado === estado}
              scroll={false}
            >
              {STATE_META[estado].label}{" "}
              <span className="num muted">
                {briefs.filter((b) => b.state === estado).length}
              </span>
            </Link>
          ))}
        </div>
        <div
          className="segmented"
          role="group"
          aria-label="Modo de visualização"
        >
          {[
            { v: "semana", l: "Por semana" },
            { v: "lista", l: "Lista" },
          ].map((opcao) => (
            <button
              key={opcao.v}
              type="button"
              aria-pressed={F.visao === opcao.v}
              onClick={() =>
                router.replace(hrefWith({ visao: opcao.v }), { scroll: false })
              }
            >
              {opcao.l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid-side">
        <aside className="panel" aria-label="Filtros do acervo">
          <div className="panel-head">
            <h2 className="h3">Filtros</h2>
            <Link
              className="btn btn-ghost btn-sm"
              href={`${pathname}?estado=${F.estado}`}
              scroll={false}
            >
              Limpar
            </Link>
          </div>
          <div className="panel-body filterbar">
            <div className="search">
              <IconSearch />
              <input
                type="search"
                placeholder="Buscar no acervo"
                defaultValue={F.q}
                aria-label="Buscar no acervo"
                onKeyDown={(event) => {
                  if (event.key === "Enter")
                    router.replace(
                      hrefWith({ q: event.currentTarget.value.trim() }),
                      {
                        scroll: false,
                      },
                    );
                }}
              />
            </div>
            {grupoFiltro("Pilar", "pilar", [
              { v: "", l: "Todos" },
              ...pilares.map((p) => ({ v: p, l: p })),
            ])}
            {grupoFiltro("ICP", "icp", [
              { v: "", l: "Todos" },
              ...icps.map((p) => ({ v: p, l: p })),
            ])}
            {grupoFiltro("Janela de anti-repetição", "periodo", [
              { v: "", l: "Tudo" },
              ...janelas.map((d) => ({ v: String(d), l: `Últimos ${d} dias` })),
            ])}
            <p className="field-help">
              As janelas são as mesmas de{" "}
              <span className="num">anti_repetition.windows</span> no manifest —
              o que aparece aqui é o que o matcher considera “recente”.
            </p>
          </div>
        </aside>

        <section>
          <p className="meta" aria-live="polite" style={{ marginBottom: 12 }}>
            {lista.length} de {doEstado.length} briefs em{" "}
            {STATE_META[F.estado]?.label.toLowerCase() ?? F.estado}
            {F.periodo && ` · janela de ${F.periodo} dias`}
          </p>
          <div className="panel">
            <div className="panel-body-flush">
              {lista.length === 0 ? (
                <EmptyState
                  title={
                    doEstado.length > 0
                      ? "Nada neste recorte"
                      : `Nenhum brief em ${STATE_META[F.estado]?.label.toLowerCase() ?? F.estado}`
                  }
                  body={
                    doEstado.length > 0
                      ? `Os ${doEstado.length} briefs deste estado continuam no disco; o filtro atual não deixa nenhum passar.`
                      : "Quando um brief for movido para este estado, o arquivo aparece aqui na próxima leitura de disco."
                  }
                  action={
                    <Link
                      className="btn btn-secondary"
                      href={`${pathname}?estado=${F.estado}`}
                      scroll={false}
                    >
                      Limpar filtros
                    </Link>
                  }
                />
              ) : F.visao === "lista" ? (
                lista.map(linha)
              ) : (
                porSemana()
              )}
            </div>
          </div>
        </section>
      </div>

      <PublishDialog
        brief={publicando}
        open={publicando !== null}
        onClose={() => setPublicando(null)}
        onConfirm={(dados) => {
          const brief = publicando;
          setPublicando(null);
          if (!brief) return;
          // A transição para publicado/ é da skill radar-mark-published: ela
          // move o arquivo, a mídia e escreve o evento. A web valida e informa.
          toast({
            tone: "ok",
            title: `Registro validado · ${brief.briefId}`,
            detail: `${fmtDate(dados.published_at)} · rode radar-mark-published com esta URL para gravar o evento e mover o arquivo.`,
          });
        }}
      />
    </>
  );
}
