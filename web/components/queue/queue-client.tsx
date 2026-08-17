"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { MediaNoneTile, MediaTile } from "@/components/ui/media";
import { PipelineGate } from "@/components/pipeline-gate";
import { ScoreBar, ScoreStrip } from "@/components/ui/score-bar";
import { Crumb, EmptyState } from "@/components/ui/pieces";
import { IconAlert, IconCheck, IconSearch } from "@/components/ui/icons";
import { fmtScore } from "@/lib/format";
import { TRANSITION_ERRORS, type BriefView, type MediaView } from "@/lib/view/brief-view";

type Escolha = number | "none" | undefined;

interface Props {
  briefs: BriefView[];
  /** Arquivos desta pasta que o loader não conseguiu ler. */
  ilegiveis: number;
  scoring: { matchScoreMin: number; borderlineMin: number };
}

const ORDENS = [
  { v: "score", l: "Score, maior primeiro" },
  { v: "score-asc", l: "Score, menor primeiro" },
  { v: "data", l: "Mais recente primeiro" },
  { v: "pilar", l: "Pilar (A–Z)" },
];

function escolhaDe(brief: BriefView): Escolha {
  if (!brief.heroChoiceDeclared) return undefined;
  return brief.heroChoice === null ? "none" : brief.heroChoice ?? undefined;
}

export function QueueClient({ briefs, ilegiveis, scoring }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();

  // O disco continua sendo a fonte da verdade: o estado local é só a camada
  // otimista por cima dele — o que já saiu da fila e a escolha desta sessão.
  // Assim um router.refresh() traz dados novos sem sobrescrever a decisão.
  const [removidos, setRemovidos] = useState<ReadonlySet<string>>(() => new Set());
  const [escolhasLocais, setEscolhasLocais] = useState<Record<string, Escolha>>({});
  const [cursor, setCursor] = useState(0);
  const [atalhosAbertos, setAtalhosAbertos] = useState(false);
  const [explicando, setExplicando] = useState<BriefView | null>(null);
  const [ampliando, setAmpliando] = useState<BriefView | null>(null);
  const [rejeitando, setRejeitando] = useState<BriefView | null>(null);
  const [motivo, setMotivo] = useState("");
  const [motivoErro, setMotivoErro] = useState(false);
  const [lote, setLote] = useState<BriefView[] | null>(null);
  const [loteStatus, setLoteStatus] = useState<Record<string, string>>({});
  const [rodandoLote, setRodandoLote] = useState(false);

  const items = useMemo(() => briefs.filter((b) => !removidos.has(b.slug)), [briefs, removidos]);

  const escolhas = useMemo<Record<string, Escolha>>(
    () =>
      Object.fromEntries(
        briefs.map((b) => [b.slug, b.slug in escolhasLocais ? escolhasLocais[b.slug] : escolhaDe(b)]),
      ),
    [briefs, escolhasLocais],
  );

  const F = {
    q: params.get("q") ?? "",
    pilar: params.get("pilar") ?? "",
    icp: params.get("icp") ?? "",
    borderline: params.get("borderline") ?? "",
    midia: params.get("midia") ?? "",
    ordenar: params.get("ordenar") ?? "score",
  };

  /** Os filtros vivem na URL: o recorte é compartilhável e sobrevive ao refresh. */
  const hrefWith = useCallback(
    (overrides: Record<string, string>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(overrides)) {
        if (!value) next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [params, pathname],
  );

  const setParam = useCallback(
    (key: string, value: string) => router.replace(hrefWith({ [key]: value }), { scroll: false }),
    [hrefWith, router],
  );

  const pilares = useMemo(
    () => [...new Set(items.map((b) => b.pilar).filter((p): p is string => Boolean(p)))].sort(),
    [items],
  );
  const icps = useMemo(
    () => [...new Set(items.map((b) => b.icp).filter((p): p is string => Boolean(p)))].sort(),
    [items],
  );

  const visiveis = useMemo(() => {
    const filtrados = items.filter((b) => {
      if (F.pilar && b.pilar !== F.pilar) return false;
      if (F.icp && b.icp !== F.icp) return false;
      if (F.borderline === "1" && !b.borderline) return false;
      if (F.borderline === "0" && b.borderline) return false;
      if (F.midia === "com" && !b.media.some((m) => !m.missing)) return false;
      if (F.midia === "sem" && b.media.length > 0) return false;
      if (F.midia === "ausente" && !b.media.some((m) => m.missing)) return false;
      if (F.q) {
        const hay = `${b.headline} ${b.hook} ${b.caption}`.toLowerCase();
        if (!hay.includes(F.q.toLowerCase())) return false;
      }
      return true;
    });

    const porScore = (a: BriefView, b: BriefView) => (b.matchScore ?? 0) - (a.matchScore ?? 0);
    const ordem: Record<string, (a: BriefView, b: BriefView) => number> = {
      score: porScore,
      "score-asc": (a, b) => (a.matchScore ?? 0) - (b.matchScore ?? 0),
      data: (a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || porScore(a, b),
      pilar: (a, b) => (a.pilar ?? "").localeCompare(b.pilar ?? "") || porScore(a, b),
    };
    return [...filtrados].sort(ordem[F.ordenar] ?? porScore);
  }, [items, F.pilar, F.icp, F.borderline, F.midia, F.q, F.ordenar]);

  const decididos = visiveis.filter((b) => escolhas[b.slug] !== undefined);

  /** A escolha vai para o frontmatter no instante em que é feita; aprovar
   *  continua sendo só a mudança de estado. */
  const escolher = useCallback(
    async (slug: string, valor: number | "none") => {
      const anterior = escolhas[slug];
      const proximo: Escolha = anterior === valor ? undefined : valor;
      setEscolhasLocais((atual) => ({ ...atual, [slug]: proximo }));
      if (proximo === undefined) return;

      const resposta = await fetch(`/api/briefs/${slug}/hero`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ heroChoice: proximo === "none" ? null : proximo }),
      }).catch(() => null);

      if (!resposta?.ok) {
        setEscolhasLocais((atual) => ({ ...atual, [slug]: anterior }));
        const corpo = await resposta?.json().catch(() => null);
        toast({
          tone: "danger",
          title: `HTTP ${resposta?.status ?? "—"} · HERO_CHOICE`,
          detail: corpo?.error ?? "Não foi possível gravar a escolha no frontmatter.",
        });
      }
    },
    [escolhas, toast],
  );

  const aprovar = useCallback(
    async (brief: BriefView) => {
      const escolha = escolhas[brief.slug];
      if (escolha === undefined) {
        toast({
          tone: "danger",
          title: "HTTP 422 · HERO_CHOICE_UNDECIDED",
          detail: TRANSITION_ERRORS.HERO_CHOICE_UNDECIDED,
        });
        return;
      }
      // `escolha` é o index declarado no frontmatter, não a posição na lista.
      if (typeof escolha === "number" && brief.media.find((m) => m.index === escolha)?.missing) {
        toast({
          tone: "danger",
          title: "HTTP 422 · MEDIA_MISSING",
          detail: TRANSITION_ERRORS.MEDIA_MISSING,
        });
        return;
      }

      const resposta = await fetch(`/api/briefs/${brief.slug}/transition`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ direction: "approve" }),
      }).catch(() => null);
      const corpo = await resposta?.json().catch(() => null);

      if (!resposta?.ok) {
        toast({
          tone: "danger",
          title: `HTTP ${resposta?.status ?? "—"} · ${(corpo?.code ?? "TRANSITION_FAILED").toUpperCase()}`,
          detail: corpo?.error ?? TRANSITION_ERRORS.ALREADY_MOVED,
        });
        return;
      }

      setRemovidos((atual) => new Set(atual).add(brief.slug));
      const apagadas: string[] = corpo?.mediaDeleted ?? [];
      toast({
        tone: "ok",
        title: `Aprovado · ${brief.briefId}`,
        detail:
          `Movido para pendente-publicacao. ` +
          (apagadas.length ? `${apagadas.length} mídia(s) apagada(s) do cache. ` : "") +
          `Evento mv-approved gravado no ledger — reverter é operação de terminal (radar-mv).`,
      });
      router.refresh();
    },
    [escolhas, router, toast],
  );

  const rejeitar = useCallback(async () => {
    const brief = rejeitando;
    if (!brief) return;
    if (!motivo.trim()) {
      setMotivoErro(true);
      return;
    }

    const resposta = await fetch(`/api/briefs/${brief.slug}/transition`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ direction: "reject", reason: motivo.trim() }),
    }).catch(() => null);
    const corpo = await resposta?.json().catch(() => null);

    if (!resposta?.ok) {
      toast({
        tone: "danger",
        title: `HTTP ${resposta?.status ?? "—"} · ${(corpo?.code ?? "TRANSITION_FAILED").toUpperCase()}`,
        detail: corpo?.error ?? TRANSITION_ERRORS.ALREADY_MOVED,
      });
      return;
    }

    setRejeitando(null);
    setRemovidos((atual) => new Set(atual).add(brief.slug));
    toast({
      tone: "ok",
      title: `Rejeitado · ${brief.briefId}`,
      detail: `Motivo gravado no ledger. ${(corpo?.mediaDeleted ?? []).length} mídia(s) apagada(s) — o cache precisa ser refeito pela varredura.`,
    });
    router.refresh();
  }, [motivo, rejeitando, router, toast]);

  const rodarLote = useCallback(async () => {
    if (!lote) return;
    setRodandoLote(true);
    // Cada transição escreve uma linha no ledger, então o lote roda
    // sequencialmente e reporta item a item.
    for (const brief of lote) {
      setLoteStatus((s) => ({ ...s, [brief.slug]: "gravando…" }));
      const resposta = await fetch(`/api/briefs/${brief.slug}/transition`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ direction: "approve" }),
      }).catch(() => null);
      const corpo = await resposta?.json().catch(() => null);

      if (resposta?.ok) {
        setLoteStatus((s) => ({ ...s, [brief.slug]: "movido · ledger ok" }));
        setRemovidos((atual) => new Set(atual).add(brief.slug));
      } else {
        setLoteStatus((s) => ({
          ...s,
          [brief.slug]: `422 · ${(corpo?.code ?? "falhou").toUpperCase()}`,
        }));
      }
    }
    setRodandoLote(false);
    toast({
      tone: "ok",
      title: "Lote concluído",
      detail: "Relatório por item na janela. Todos os eventos foram para o ledger.",
    });
    router.refresh();
  }, [lote, router, toast]);

  /* ── teclado ────────────────────────────────────────────────────────────
     Só quando não há modal aberto e o foco não está num campo de texto. */
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (atalhosAbertos || explicando || ampliando || rejeitando || lote) return;
      const tag = (event.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const atual = visiveis[cursor];
      if (event.key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        setCursor((c) => Math.min(c + 1, visiveis.length - 1));
        return;
      }
      if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
        return;
      }
      if (event.key === "/") {
        event.preventDefault();
        document.getElementById("busca")?.focus();
        return;
      }
      if (event.key === "?") {
        event.preventDefault();
        setAtalhosAbertos(true);
        return;
      }
      if (!atual) return;
      if (event.key === "a") {
        event.preventDefault();
        void aprovar(atual);
        return;
      }
      if (event.key === "r") {
        event.preventDefault();
        setMotivo("");
        setMotivoErro(false);
        setRejeitando(atual);
        return;
      }
      if (event.key === "o") {
        event.preventDefault();
        router.push(`/briefs/${atual.state}/${atual.slug}`);
        return;
      }
      if (event.key === "e") {
        event.preventDefault();
        router.push(`/briefs/${atual.state}/${atual.slug}/editar`);
        return;
      }
      if (/^[0-9]$/.test(event.key)) {
        const n = Number(event.key);
        if (n === 0) {
          event.preventDefault();
          void escolher(atual.slug, "none");
        } else if (n <= atual.media.length) {
          event.preventDefault();
          void escolher(atual.slug, atual.media[n - 1].index);
        }
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ampliando, aprovar, atalhosAbertos, cursor, escolher, explicando, lote, rejeitando, router, visiveis]);

  useEffect(() => {
    const alvo = visiveis[cursor];
    if (alvo) document.getElementById(alvo.slug)?.scrollIntoView({ block: "nearest" });
  }, [cursor, visiveis]);

  const grupoFiltro = (titulo: string, chave: string, opcoes: { v: string; l: string }[]) => (
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
    <>
      <div className="page-head">
        <div className="row-between">
          <Crumb
            items={[{ label: "Painel", href: "/" }, { label: "Fila" }]}
            back={{ href: "/", destino: "Painel" }}
          />
          <span className="eyebrow">store/briefs/pendente-aprovacao/</span>
        </div>
        <div className="row-between" style={{ marginTop: 12 }}>
          <h1 className="display">Fila de aprovação</h1>
          <div className="row-tight">
          <button className="btn btn-secondary" type="button" onClick={() => setAtalhosAbertos(true)}>
            Atalhos <span className="kbd">?</span>
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => {
              if (decididos.length === 0) {
                toast({
                  tone: "danger",
                  title: "Nada pronto para lote",
                  detail:
                    "Nenhum brief do recorte atual tem a escolha de arte decidida. Decida a arte de pelo menos um antes.",
                });
                return;
              }
              setLoteStatus(Object.fromEntries(decididos.map((b) => [b.slug, "na fila"])));
              setLote(decididos);
            }}
          >
            Aprovar em lote
          </button>
          </div>
        </div>
        {ilegiveis > 0 && (
          <p className="field-error" style={{ marginTop: 10 }}>
            {ilegiveis} arquivo(s) desta pasta não puderam ser lidos e ficam fora da fila.
          </p>
        )}
      </div>

      <PipelineGate variant="fila">
      <div className="grid-side">
        <aside className="panel" aria-label="Filtros">
          <div className="panel-head">
            <h2 className="h3">Filtros</h2>
            <Link className="btn btn-ghost btn-sm" href={pathname} scroll={false}>
              Limpar
            </Link>
          </div>
          <div className="panel-body filterbar">
            <div className="search">
              <IconSearch />
              <input
                type="search"
                id="busca"
                placeholder="Buscar em headline, hook e caption"
                defaultValue={F.q}
                aria-label="Buscar nos briefs da fila"
                onKeyDown={(event) => {
                  if (event.key === "Enter") setParam("q", event.currentTarget.value.trim());
                  if (event.key === "Escape") {
                    event.currentTarget.value = "";
                    event.currentTarget.blur();
                  }
                }}
              />
            </div>
            {grupoFiltro("Pilar", "pilar", [
              { v: "", l: "Todos" },
              ...pilares.map((p) => ({ v: p, l: p })),
            ])}
            {grupoFiltro("ICP", "icp", [{ v: "", l: "Todos" }, ...icps.map((p) => ({ v: p, l: p }))])}
            {grupoFiltro("Decisão", "borderline", [
              { v: "", l: "Todos" },
              { v: "1", l: "Só borderline" },
              { v: "0", l: "Sem borderline" },
            ])}
            {grupoFiltro("Mídia em cache", "midia", [
              { v: "", l: "Todas" },
              { v: "com", l: "Com candidata" },
              { v: "ausente", l: "Com arquivo ausente" },
              { v: "sem", l: "Sem candidata" },
            ])}
            <p className="field-help">
              Os filtros vivem na URL — este recorte é compartilhável e sobrevive ao refresh.
            </p>
          </div>
        </aside>

        <section>
          <div className="row-between" style={{ marginBottom: 14 }}>
            <p className="meta" aria-live="polite">
              {visiveis.length} de {items.length} briefs
              {visiveis.filter((b) => b.borderline).length > 0 &&
                ` · ${visiveis.filter((b) => b.borderline).length} borderline`}
              {` · ${visiveis.length - decididos.length} sem arte decidida`}
            </p>
            <div className="row-tight">
              <label className="eyebrow" htmlFor="ordenar">
                Ordenar
              </label>
              <select
                className="select"
                id="ordenar"
                style={{ width: "auto" }}
                value={F.ordenar}
                onChange={(event) => setParam("ordenar", event.target.value)}
              >
                {ORDENS.map((o) => (
                  <option value={o.v} key={o.v}>
                    {o.l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="panel">
            <div className="panel-body-flush">
              {visiveis.length === 0 ? (
                items.length > 0 ? (
                  <EmptyState
                    title="Nenhum brief neste recorte"
                    body={`Os ${items.length} briefs da fila continuam no disco — o filtro atual é que não deixa nenhum passar.`}
                    action={
                      <Link className="btn btn-secondary" href={pathname} scroll={false}>
                        Limpar filtros
                      </Link>
                    }
                  />
                ) : (
                  <EmptyState
                    title="Fila zerada"
                    body="Nada pendente de aprovação. A próxima varredura escreve direto em store/briefs/pendente-aprovacao/."
                    action={
                      <Link className="btn btn-secondary" href="/acervo">
                        Ver o acervo
                      </Link>
                    }
                  />
                )
              ) : (
                visiveis.map((brief, index) => {
                  const escolha = escolhas[brief.slug];
                  const decidido = escolha !== undefined;
                  return (
                    <article
                      className={`brief-row${brief.borderline ? " is-borderline" : ""}${index === cursor ? " is-cursor" : ""}`}
                      id={brief.slug}
                      key={brief.slug}
                      tabIndex={-1}
                      aria-label={brief.headline}
                      onClick={() => setCursor(index)}
                    >
                      <div className="queue-score">
                        <span className="num strong" style={{ fontSize: 19, lineHeight: 1 }}>
                          {brief.matchScore === null ? "—" : fmtScore(brief.matchScore)}
                        </span>
                        <ScoreStrip breakdown={brief.breakdown} score={brief.matchScore} />
                        <button
                          className="btn btn-ghost btn-sm"
                          type="button"
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                          onClick={() => setExplicando(brief)}
                        >
                          Por quê?
                        </button>
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <h2 className="brief-headline">
                          <Link href={`/briefs/${brief.state}/${brief.slug}`}>{brief.headline}</Link>
                        </h2>
                        <p className="brief-hook clamp-2">{brief.hook}</p>

                        <div className="row-tight" style={{ marginTop: 10 }}>
                          <span className="meta">{brief.briefId}</span>
                          {brief.pilar && <span className="tag">{brief.pilar}</span>}
                          {brief.icp && <span className="tag">{brief.icp}</span>}
                          {brief.borderline && (
                            <span className="pill pill-warn">borderline · decisão sua</span>
                          )}
                        </div>

                        {brief.warnings.length > 0 && (
                          <div
                            className="alert alert-warning"
                            style={{ marginTop: 11, padding: "8px 11px" }}
                          >
                            <IconAlert />
                            <div className="alert-body">
                              <span className="small">{brief.warnings.join(" · ")}</span>
                            </div>
                          </div>
                        )}

                        <div className="queue-media">
                          <MediaNoneTile
                            selected={escolha === "none"}
                            compact
                            onSelect={() => void escolher(brief.slug, "none")}
                          />
                          {brief.media.map((media, i) => (
                            <MediaTile
                              key={`${brief.slug}-${media.index}`}
                              media={media}
                              position={i + 1}
                              compact
                              selected={escolha === media.index}
                              onSelect={() => void escolher(brief.slug, media.index)}
                            />
                          ))}
                          {brief.media.length > 0 && (
                            <button
                              className="btn btn-ghost btn-sm"
                              type="button"
                              style={{ alignSelf: "center" }}
                              onClick={() => setAmpliando(brief)}
                            >
                              Ampliar
                            </button>
                          )}
                        </div>

                        <p
                          className={`hero-status ${decidido ? "is-set" : "is-pending"}`}
                          style={{ marginTop: 9 }}
                        >
                          {decidido ? <IconCheck /> : <IconAlert />}
                          {decidido
                            ? escolha === "none"
                              ? "Sem foto — o Open Design compõe card só-tipografia"
                              : `Foto ${escolha} escolhida: ${brief.media.find((m) => m.index === escolha)?.file ?? "—"}`
                            : "Escolha da arte pendente — aprovar exige uma decisão explícita"}
                        </p>

                        <div className="brief-actions">
                          <button
                            className="btn btn-ok"
                            type="button"
                            title="Atalho: a"
                            onClick={() => void aprovar(brief)}
                          >
                            Aprovar
                          </button>
                          <button
                            className="btn btn-danger"
                            type="button"
                            title="Atalho: r"
                            onClick={() => {
                              setMotivo("");
                              setMotivoErro(false);
                              setRejeitando(brief);
                            }}
                          >
                            Rejeitar
                          </button>
                          <Link
                            className="btn btn-ghost"
                            href={`/briefs/${brief.state}/${brief.slug}`}
                          >
                            Ver detalhes
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>

          <p className="shortcut-hint" style={{ marginTop: 14 }}>
            <span className="kbd">j</span>
            <span className="kbd">k</span> navegar
            <span className="dot-sep" />
            <span className="kbd">1</span>–<span className="kbd">9</span> escolher foto
            <span className="dot-sep" />
            <span className="kbd">a</span> aprovar
            <span className="dot-sep" />
            <span className="kbd">r</span> rejeitar
          </p>
        </section>
      </div>
      </PipelineGate>

      {/* ── atalhos ─────────────────────────────────────────────────────── */}
      <Modal
        open={atalhosAbertos}
        onClose={() => setAtalhosAbertos(false)}
        eyebrow="Fila de aprovação"
        title="Atalhos de teclado"
      >
        <div className="stack-sm">
          {[
            ["j / ↓", "Próximo brief"],
            ["k / ↑", "Brief anterior"],
            ["1 – 9", "Escolher a foto candidata correspondente"],
            ["0", "Marcar “sem foto” (card só-tipografia)"],
            ["a", "Aprovar o brief sob o cursor"],
            ["r", "Rejeitar (abre o motivo)"],
            ["o", "Abrir o detalhe"],
            ["e", "Abrir o editor"],
            ["/", "Focar a busca"],
            ["?", "Esta janela"],
          ].map(([tecla, descricao]) => (
            <div className="row-between" key={tecla}>
              <span className="small">{descricao}</span>
              <span className="row-tight">
                {tecla.split(" ").map((parte, i) =>
                  parte === "/" || parte === "–" ? (
                    <span className="meta" key={i}>
                      {parte}
                    </span>
                  ) : (
                    <span className="kbd" key={i}>
                      {parte}
                    </span>
                  ),
                )}
              </span>
            </div>
          ))}
        </div>
      </Modal>

      {/* ── por que este score ──────────────────────────────────────────── */}
      <Modal
        open={explicando !== null}
        onClose={() => setExplicando(null)}
        wide
        eyebrow={explicando?.briefId}
        title={`Como o score ${explicando?.matchScore === null || explicando === null ? "—" : fmtScore(explicando.matchScore)} foi formado`}
      >
        {explicando && (
          <>
            <ScoreBar
              score={explicando.matchScore}
              breakdown={explicando.breakdown}
              min={scoring.matchScoreMin}
              borderline={explicando.borderline}
            />
            <hr className="rule" style={{ margin: "20px 0" }} />
            <p className="field-label">Por que casou com o perfil</p>
            <p className="small" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
              {explicando.whyMatch ?? "O frontmatter deste brief não traz why_match."}
            </p>
            {explicando.borderlineReason && (
              <div className="sunken" style={{ marginTop: 16 }}>
                <p className="field-label">Por que veio marcado como borderline</p>
                <p className="small" style={{ marginTop: 5 }}>
                  {explicando.borderlineReason}
                </p>
                <p className="meta" style={{ marginTop: 4 }}>
                  faixa {fmtScore(scoring.borderlineMin)} – {fmtScore(scoring.matchScoreMin)}
                </p>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* ── candidatas ampliadas ────────────────────────────────────────── */}
      <Modal
        open={ampliando !== null}
        onClose={() => setAmpliando(null)}
        wide
        eyebrow={ampliando?.briefId}
        title="Candidatas à arte"
      >
        {ampliando && (
          <>
            <p className="small muted">
              Proporção pedida no visual_brief:{" "}
              <span className="num strong">{ampliando.visualBrief.aspectRatio}</span>. Clique para
              escolher.
            </p>
            <div className="grid-2" style={{ marginTop: 16 }}>
              {ampliando.media.map((media) => (
                <CandidataAmpliada
                  key={media.index}
                  media={media}
                  escolhida={escolhas[ampliando.slug] === media.index}
                  onEscolher={() => {
                    void escolher(ampliando.slug, media.index);
                    toast({
                      title: "Arte escolhida",
                      detail: `foto ${media.index} · gravada em hero_choice no frontmatter.`,
                    });
                  }}
                />
              ))}
            </div>
          </>
        )}
      </Modal>

      {/* ── rejeitar ────────────────────────────────────────────────────── */}
      <Modal
        open={rejeitando !== null}
        onClose={() => setRejeitando(null)}
        eyebrow={rejeitando?.briefId}
        title="Rejeitar este brief?"
        footer={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setRejeitando(null)}>
              Cancelar
            </button>
            <button className="btn btn-danger" type="button" onClick={() => void rejeitar()}>
              Rejeitar e apagar mídias
            </button>
          </>
        }
      >
        {rejeitando && (
          <>
            <p className="small">
              Rejeitar move o arquivo para <span className="num">store/briefs/rejeitado/</span> e{" "}
              <strong>apaga todas as {rejeitando.media.length} mídias em cache</strong>. O brief é
              preservado para a checagem de anti-repetição.
            </p>
            <div className="field" style={{ marginTop: 16 }}>
              <label htmlFor="motivo">
                Motivo <span className="muted">— obrigatório, vai para o ledger</span>
              </label>
              <textarea
                className="textarea"
                id="motivo"
                data-autofocus
                value={motivo}
                onChange={(event) => {
                  setMotivo(event.target.value);
                  setMotivoErro(false);
                }}
                placeholder="Ex.: fora do escopo — o produto citado não é lote, sítio, chácara nem MCMV."
              />
              {motivoErro && <p className="field-error">{TRANSITION_ERRORS.REASON_REQUIRED}</p>}
            </div>
          </>
        )}
      </Modal>

      {/* ── lote ────────────────────────────────────────────────────────── */}
      <Modal
        open={lote !== null}
        onClose={() => (rodandoLote ? undefined : setLote(null))}
        wide
        eyebrow="Ações em lote"
        title={`${lote?.length ?? 0} briefs prontos para aprovação`}
        footer={
          <>
            <button
              className="btn btn-secondary"
              type="button"
              disabled={rodandoLote}
              onClick={() => setLote(null)}
            >
              Fechar
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={rodandoLote}
              onClick={() => void rodarLote()}
            >
              {rodandoLote ? "Rodando…" : `Aprovar os ${lote?.length ?? 0}`}
            </button>
          </>
        }
      >
        <p className="small">
          Cada transição escreve uma linha no ledger, então o lote roda{" "}
          <strong>sequencialmente</strong> e reporta item a item. Briefs sem arte decidida ficam de
          fora.
        </p>
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="ds-table">
            <thead>
              <tr>
                <th>Brief</th>
                <th>Arte</th>
                <th className="num-col">Score</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {(lote ?? []).map((brief) => (
                <tr key={brief.slug}>
                  <td>
                    <span className="meta">{brief.briefId}</span>
                    <br />
                    <span className="truncate" style={{ maxWidth: "34ch", display: "block" }}>
                      {brief.headline}
                    </span>
                  </td>
                  <td className="small">
                    {escolhas[brief.slug] === "none" ? "sem foto" : `foto ${escolhas[brief.slug]}`}
                  </td>
                  <td className="num-col">
                    {brief.matchScore === null ? "—" : fmtScore(brief.matchScore)}
                  </td>
                  <td className="small muted">{loteStatus[brief.slug] ?? "na fila"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </>
  );
}

function CandidataAmpliada({
  media,
  escolhida,
  onEscolher,
}: {
  media: MediaView;
  escolhida: boolean;
  onEscolher: () => void;
}) {
  return (
    <div className="panel">
      {media.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={media.url}
          alt={media.alt ?? ""}
          style={{ width: "100%", borderRadius: "8px 8px 0 0", objectFit: "cover" }}
        />
      ) : (
        <div className="ph-img missing" style={{ borderRadius: "8px 8px 0 0" }} aria-hidden="true">
          ⚠ arquivo ausente do cache
        </div>
      )}
      <div className="panel-body" style={{ padding: 12 }}>
        <p className="meta">{media.file ?? "sem arquivo"}</p>
        <p className="small" style={{ marginTop: 6 }}>
          <span className="field-label">alt:</span> {media.alt ?? "—"}
        </p>
        <p className="meta" style={{ marginTop: 6 }}>
          {media.licenseHint ?? "sem license_hint no frontmatter"}
        </p>
        {media.licensable === false && (
          <div className="alert alert-danger" style={{ marginTop: 10, padding: "8px 10px" }}>
            <IconAlert />
            <div className="alert-body">
              <span className="small">
                Sem cessão comercial. Usar imagem de veículo de imprensa em post patrocinado tem
                implicação legal.
              </span>
            </div>
          </div>
        )}
        {media.missing && (
          <div className="alert alert-warning" style={{ marginTop: 10, padding: "8px 10px" }}>
            <IconAlert />
            <div className="alert-body">
              <span className="small">
                Declarada no frontmatter mas ausente do disco. Aprovar com ela selecionada devolve
                422.
              </span>
            </div>
          </div>
        )}
        <button
          className="btn btn-secondary btn-sm btn-block"
          style={{ marginTop: 12 }}
          type="button"
          onClick={onEscolher}
        >
          {escolhida ? "Escolhida ✓" : "Escolher esta"}
        </button>
      </div>
    </div>
  );
}
