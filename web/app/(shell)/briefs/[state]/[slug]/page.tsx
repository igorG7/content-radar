import Link from "next/link";
import { notFound } from "next/navigation";
import { BriefActions } from "@/components/brief-actions";
import { IgPreview, IG_CUT } from "@/components/ui/ig-preview";
import { MediaTile } from "@/components/ui/media";
import { ScoreBar } from "@/components/ui/score-bar";
import { Counter, Crumb, LIMITES, StatePill } from "@/components/ui/pieces";
import { IconAlert, IconPencil, IconX } from "@/components/ui/icons";
import { fmtDate } from "@/lib/format";
import { BRIEF_STATES, type BriefState } from "@/lib/manifest";
import { radarStore } from "@/lib/store";
import { EVENT_TONE, eventLabel } from "@/lib/view/ledger-view";
import { STATE_META, scoringOf, toBriefView } from "@/lib/view/brief-view";

export const dynamic = "force-dynamic";

function isBriefState(value: string): value is BriefState {
  return (BRIEF_STATES as readonly string[]).includes(value);
}

export default async function DetalheDoBrief({
  params,
}: PageProps<"/briefs/[state]/[slug]">) {
  const { state, slug } = await params;
  if (!isBriefState(state)) notFound();

  const store = await radarStore();
  const [manifest, ledger] = await Promise.all([
    store.manifest(),
    store.lerLedger(),
  ]);
  const scoring = scoringOf(manifest);

  const encontrado = await store.buscarBrief(slug, state).catch(() => null);
  if (!encontrado) notFound();

  const brief = toBriefView(encontrado, scoring);
  const naFila = brief.state === "pendente-aprovacao";
  // Trilha e botão de voltar leem a mesma variável: o pai do detalhe muda com
  // o estado, e divergirem seria pior do que não ter botão.
  const pai = naFila
    ? { href: "/fila", label: "Fila" }
    : { href: `/acervo?estado=${brief.state}`, label: "Acervo" };
  const editavel = naFila || brief.state === "pendente-publicacao";
  const eventos = ledger.events
    .filter((e) => e.brief_id === brief.briefId)
    .reverse();
  const captionFlat = brief.caption.replace(/\n+/g, " ");

  return (
    <>
      <div className="page-head">
        <Crumb
          items={[
            { label: "Painel", href: "/" },
            { label: pai.label, href: pai.href },
            { label: "Detalhes" },
          ]}
          tail={<span className="num">{brief.briefId}</span>}
          back={{ href: pai.href, destino: pai.label }}
        />
        <div
          className="row-between"
          style={{ marginTop: 12, alignItems: "flex-start" }}
        >
          <div style={{ flex: "1 1 420px", minWidth: 0 }}>
            <div className="row-tight" style={{ marginBottom: 10 }}>
              <StatePill state={brief.state} />
              {brief.pilar && <span className="tag">{brief.pilar}</span>}
              {brief.icp && <span className="tag">{brief.icp}</span>}
              {brief.scope && (
                <span className="tag">escopo: {brief.scope}</span>
              )}
              {brief.borderline && (
                <span className="pill pill-warn">borderline</span>
              )}
            </div>
            <h1 className="display">{brief.headline}</h1>
            <p className="lead" style={{ marginTop: 12 }}>
              {brief.hook}
            </p>
          </div>
          <BriefActions brief={brief} />
        </div>
      </div>

      <div className="grid-main">
        <div className="stack">
          {/* ── 1 · decisão ────────────────────────────────────────────── */}
          <section className="panel">
            <div className="panel-head">
              <h2 className="h3">Decisão</h2>
              <span className="meta">
                match_score_breakdown · {brief.breakdown.length} componentes
                ponderados
              </span>
            </div>
            <div className="panel-body">
              <ScoreBar
                score={brief.matchScore}
                breakdown={brief.breakdown}
                min={scoring.matchScoreMin}
                borderline={brief.borderline}
              />
              <hr className="rule" style={{ margin: "20px 0" }} />
              <p className="field-label">Por que casou com o perfil</p>
              <p style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
                {brief.whyMatch ?? "Este brief não traz why_match."}
              </p>
              <div className="grid-2" style={{ marginTop: 20 }}>
                <div className="sunken">
                  <p className="field-label">Faixa de decisão</p>
                  <p className="small" style={{ marginTop: 6 }}>
                    Promove a partir de{" "}
                    <span className="num">{scoring.matchScoreMin}</span>;
                    borderline entre{" "}
                    <span className="num">{scoring.borderlineMin}</span> e o
                    corte.
                  </p>
                  {brief.borderlineReason && (
                    <p className="meta" style={{ marginTop: 6 }}>
                      {brief.borderlineReason}
                    </p>
                  )}
                </div>
                <div className="sunken">
                  <p className="field-label">Estado</p>
                  <p style={{ marginTop: 6 }}>
                    <StatePill state={brief.state} />
                  </p>
                  <p className="meta" style={{ marginTop: 8 }}>
                    {brief.slug}
                  </p>
                </div>
              </div>
              {brief.warnings.length > 0 && (
                <div className="alert alert-warning" style={{ marginTop: 16 }}>
                  <IconAlert />
                  <div className="alert-body">
                    <strong>{brief.warnings.length} aviso(s) do loader</strong>
                    <p className="small" style={{ marginTop: 4 }}>
                      {brief.warnings.join(" · ")}
                    </p>
                  </div>
                </div>
              )}
              {brief.rejectReason && (
                <div className="alert alert-danger" style={{ marginTop: 16 }}>
                  <IconX />
                  <div className="alert-body">
                    <strong>Motivo da rejeição</strong>
                    <p className="small" style={{ marginTop: 4 }}>
                      {brief.rejectReason}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── 2 · copy ───────────────────────────────────────────────── */}
          <section className="panel">
            <div className="panel-head">
              <h2 className="h3">Copy</h2>
              {editavel ? (
                <Link
                  className="btn btn-secondary btn-sm"
                  href={`/briefs/${brief.state}/${brief.slug}/editar`}
                >
                  <IconPencil />
                  Editar copy
                </Link>
              ) : (
                <span className="meta">read-only neste estado</span>
              )}
            </div>
            <div className="panel-body">
              <div className="copy-block">
                <div className="row-between">
                  <span className="field-label">headline</span>
                  <Counter
                    value={brief.headline.length}
                    limit={LIMITES.headline}
                  />
                </div>
                <p className="h2" style={{ marginTop: 6 }}>
                  {brief.headline}
                </p>
              </div>
              <div className="copy-block">
                <div className="row-between">
                  <span className="field-label">hook</span>
                  <Counter value={brief.hook.length} limit={LIMITES.hook} />
                </div>
                <p className="copy-text" style={{ marginTop: 6 }}>
                  {brief.hook}
                </p>
              </div>
              <div className="copy-block">
                <div className="row-between">
                  <span className="field-label">caption_draft</span>
                  <Counter
                    value={brief.caption.length}
                    limit={LIMITES.caption}
                  />
                </div>
                <p className="copy-text small" style={{ marginTop: 6 }}>
                  {brief.caption}
                </p>
              </div>
              <div className="copy-block">
                <div className="row-between">
                  <span className="field-label">hashtags</span>
                  <Counter
                    value={brief.hashtags.length}
                    limit={LIMITES.hashtags}
                  />
                </div>
                <div className="row-tight" style={{ marginTop: 8 }}>
                  {brief.hashtags.map((tag) => (
                    <span className="chip" key={tag}>
                      {tag.startsWith("#") ? tag : `#${tag}`}
                    </span>
                  ))}
                  {brief.hashtags.length === 0 && (
                    <span className="small muted">nenhuma</span>
                  )}
                </div>
              </div>
              <div className="copy-block">
                <span className="field-label">cta</span>
                <p style={{ marginTop: 6 }}>{brief.cta || "—"}</p>
              </div>
            </div>
          </section>

          {/* ── 3 · arte ───────────────────────────────────────────────── */}
          <section className="panel">
            <div className="panel-head">
              <h2 className="h3">Arte</h2>
              <span className="meta">
                visual_brief · aspect_ratio {brief.visualBrief.aspectRatio}
              </span>
            </div>
            <div className="panel-body">
              <div className="row-between" style={{ marginBottom: 10 }}>
                <span className="field-label">Candidatas</span>
                <span
                  className={
                    !brief.heroChoiceDeclared
                      ? "pill pill-warn"
                      : "pill pill-ok"
                  }
                >
                  {!brief.heroChoiceDeclared
                    ? "hero_choice pendente"
                    : brief.heroChoice === null
                      ? "hero_choice: null · só tipografia"
                      : `foto ${brief.heroChoice} escolhida`}
                </span>
              </div>

              {brief.media.length > 0 ? (
                <>
                  <div className="media-grid">
                    {brief.media.map((media, i) => (
                      <MediaTile
                        key={media.index}
                        media={media}
                        position={i + 1}
                      />
                    ))}
                  </div>
                  <div className="stack-sm" style={{ marginTop: 14 }}>
                    {brief.media
                      .filter((m) => m.licensable === false)
                      .map((m) => (
                        <div
                          className="alert alert-danger"
                          style={{ padding: "9px 12px" }}
                          key={`l-${m.index}`}
                        >
                          <IconAlert />
                          <div className="alert-body">
                            <span className="small">
                              <span className="num">{m.file}</span> —{" "}
                              {m.licenseHint ?? "sem license_hint"}. Sem cessão
                              comercial: não usar como hero.
                            </span>
                          </div>
                        </div>
                      ))}
                    {brief.media
                      .filter((m) => m.missing)
                      .map((m) => (
                        <div
                          className="alert alert-warning"
                          style={{ padding: "9px 12px" }}
                          key={`m-${m.index}`}
                        >
                          <IconAlert />
                          <div className="alert-body">
                            <span className="small">
                              <span className="num">{m.file}</span> — declarada
                              declarada, mas ausente do cache.
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                  <details style={{ marginTop: 14 }}>
                    <summary
                      className="field-label"
                      style={{ cursor: "pointer" }}
                    >
                      Ver alt e licença de cada candidata
                    </summary>
                    <dl className="kv" style={{ marginTop: 12 }}>
                      {brief.media.map((m, i) => (
                        <div key={m.index} style={{ display: "contents" }}>
                          <dt>
                            {i + 1} · {m.file}
                          </dt>
                          <dd>
                            {m.alt ?? "sem alt"}
                            <br />
                            <span className="meta">
                              {m.licenseHint ?? "sem license_hint"}
                            </span>
                            {m.cloudUrl && (
                              <>
                                <br />
                                <a
                                  className="link link-ext meta"
                                  href={m.cloudUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  cloud_url
                                </a>
                              </>
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                </>
              ) : (
                <p className="small muted">
                  Nenhuma mídia candidata em cache. O card sai só-tipografia.
                </p>
              )}

              <hr className="rule" style={{ margin: "20px 0" }} />
              <div className="grid-2">
                <div>
                  <p className="field-label">must_have</p>
                  <ul className="list-marks" style={{ marginTop: 8 }}>
                    {brief.visualBrief.mustHave.length > 0 ? (
                      brief.visualBrief.mustHave.map((item, i) => (
                        <li key={item}>
                          <span>{i + 1}</span>
                          <span>{item}</span>
                        </li>
                      ))
                    ) : (
                      <li>
                        <span>—</span>
                        <span className="muted">
                          nada obrigatório declarado
                        </span>
                      </li>
                    )}
                  </ul>
                </div>
                <div>
                  <p className="field-label">avoid_visual</p>
                  <ul className="list-marks" style={{ marginTop: 8 }}>
                    {brief.visualBrief.avoidVisual.length > 0 ? (
                      brief.visualBrief.avoidVisual.map((item) => (
                        <li key={item}>
                          <span style={{ color: "var(--danger)" }}>✕</span>
                          <span>{item}</span>
                        </li>
                      ))
                    ) : (
                      <li>
                        <span>—</span>
                        <span className="muted">sem restrição declarada</span>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
              <dl className="kv" style={{ marginTop: 20 }}>
                <dt>od_skill_ref</dt>
                <dd>
                  <span className="num">{brief.odSkillRef ?? "—"}</span>
                </dd>
                <dt>base_template</dt>
                <dd>
                  <span className="num">
                    {brief.visualBrief.baseTemplate ?? "—"}
                  </span>
                </dd>
                <dt>alternativas</dt>
                <dd>
                  {brief.odSkillAlternatives.length > 0 ? (
                    brief.odSkillAlternatives.map((a) => (
                      <span className="tag" key={a} style={{ marginRight: 6 }}>
                        {a}
                      </span>
                    ))
                  ) : (
                    <span className="muted">—</span>
                  )}
                </dd>
              </dl>
              {brief.visualBrief.compositionNotes && (
                <>
                  <p className="field-label" style={{ marginTop: 20 }}>
                    composition_notes
                  </p>
                  <p className="copy-text small" style={{ marginTop: 6 }}>
                    {brief.visualBrief.compositionNotes}
                  </p>
                </>
              )}
            </div>
          </section>

          {/* ── 4 · procedência ────────────────────────────────────────── */}
          <section className="panel">
            <div className="panel-head">
              <h2 className="h3">Procedência</h2>
              <span className="meta">de onde essa pauta veio</span>
            </div>
            <div className="panel-body">
              <p className="field-label">source_urls</p>
              <ul className="stack-sm" style={{ marginTop: 8 }}>
                {brief.sourceUrls.length > 0 ? (
                  brief.sourceUrls.map((url) => (
                    <li className="small" key={url}>
                      <a
                        className="link link-ext"
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {url}
                      </a>
                    </li>
                  ))
                ) : (
                  <li className="small muted">
                    Nenhuma URL registrada — brief de origem interna.
                  </li>
                )}
              </ul>
              {brief.sourceExcerpts.length > 0 && (
                <>
                  <p className="field-label" style={{ marginTop: 20 }}>
                    source_excerpts
                  </p>
                  <div className="stack-sm" style={{ marginTop: 8 }}>
                    {brief.sourceExcerpts.map((trecho, i) => (
                      <blockquote
                        className="sunken small"
                        style={{ fontStyle: "italic" }}
                        key={i}
                      >
                        {trecho}
                      </blockquote>
                    ))}
                  </div>
                </>
              )}
              <hr className="rule" style={{ margin: "20px 0" }} />
              <dl className="kv">
                <dt>brief_id</dt>
                <dd className="num">{brief.briefId}</dd>
                <dt>scan_id</dt>
                <dd className="num">{brief.scanId ?? "—"}</dd>
                <dt>origin</dt>
                <dd className="num">{brief.origin ?? "—"}</dd>
                <dt>created_at</dt>
                <dd className="num">
                  {brief.createdAt ? fmtDate(brief.createdAt, true) : "—"}
                </dd>
                {brief.updatedAt && (
                  <>
                    <dt>updated_at</dt>
                    <dd className="num">{fmtDate(brief.updatedAt, true)}</dd>
                  </>
                )}
                {brief.handoffAt && (
                  <>
                    <dt>handoff_at</dt>
                    <dd className="num">{fmtDate(brief.handoffAt, true)}</dd>
                  </>
                )}
                {brief.publishedAt && (
                  <>
                    <dt>published_at</dt>
                    <dd className="num">{fmtDate(brief.publishedAt, true)}</dd>
                  </>
                )}
                {brief.igPostUrl && (
                  <>
                    <dt>ig_post_url</dt>
                    <dd>
                      <a
                        className="link link-ext"
                        href={brief.igPostUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {brief.igPostUrl}
                      </a>
                    </dd>
                  </>
                )}
                {brief.rejectedAt && (
                  <>
                    <dt>rejected_at</dt>
                    <dd className="num">{fmtDate(brief.rejectedAt, true)}</dd>
                  </>
                )}
              </dl>
            </div>
          </section>
        </div>

        {/* ── lateral: prévia + linha do tempo ─────────────────────────── */}
        <div className="stack">
          <div className="panel">
            <div className="panel-head">
              <h2 className="h3">Prévia da legenda no feed</h2>
              <span className="meta">{brief.visualBrief.aspectRatio}</span>
            </div>
            <div
              className="panel-body"
              style={{ display: "grid", justifyItems: "center" }}
            >
              <IgPreview
                caption={brief.caption}
                hashtags={brief.hashtags}
                aspectRatio={brief.visualBrief.aspectRatio}
                legenda={
                  captionFlat.length > IG_CUT
                    ? `A arte é ilustrativa — a peça sai do Open Design a partir do visual_brief. O que se testa aqui é a legenda: o Instagram corta em ~${IG_CUT} caracteres, e neste texto isso cai em “…${captionFlat.slice(IG_CUT - 22, IG_CUT)}”`
                    : "A arte é ilustrativa — a peça sai do Open Design a partir do visual_brief. Esta legenda cabe inteira antes do corte do Instagram."
                }
              />
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2 className="h3">Linha do tempo</h2>
              <Link
                className="btn btn-ghost btn-sm"
                href={`/ledger?brief=${brief.briefId}`}
              >
                Ledger →
              </Link>
            </div>
            <div className="panel-body">
              {eventos.length > 0 ? (
                <div className="timeline">
                  {eventos.map((evento, index) => (
                    <div
                      className="timeline-item"
                      key={`${evento.ts}-${index}`}
                    >
                      <div className="timeline-rail">
                        <span
                          className={`timeline-dot${EVENT_TONE[evento.event] ? ` is-${EVENT_TONE[evento.event]}` : ""}`}
                        />
                        <span className="timeline-line" />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p className="small strong">
                          {eventLabel(evento.event)}
                        </p>
                        <p className="meta">
                          {evento.actor ?? "—"}
                          <span className="dot-sep" />
                          {fmtDate(evento.ts, true)}
                        </p>
                        {evento.extra &&
                          Object.keys(evento.extra).length > 0 && (
                            <div className="json-view" style={{ marginTop: 6 }}>
                              {Object.entries(evento.extra).map(
                                ([chave, valor]) => (
                                  <div className="json-row" key={chave}>
                                    <span className="json-key">{chave}</span>
                                    <span className="json-val">
                                      {typeof valor === "object" &&
                                      valor !== null
                                        ? JSON.stringify(valor)
                                        : String(valor)}
                                    </span>
                                  </div>
                                ),
                              )}
                            </div>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="small muted">
                  Nenhum evento com este brief_id. O ledger só registra
                  transições e correções.
                </p>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2 className="h3">Ciclo da pauta</h2>
            </div>
            <div className="panel-body stack-sm">
              {BRIEF_STATES.map((estado) => (
                <div className="row-between" key={estado}>
                  <span
                    className="small"
                    style={
                      estado === brief.state
                        ? undefined
                        : { color: "var(--muted)" }
                    }
                  >
                    {STATE_META[estado].label}
                  </span>
                  {estado === brief.state && <span className="meta">aqui</span>}
                </div>
              ))}
              <p className="field-help">
                Cada transição vira evento no ledger. O estado atual é o
                resultado deles, e a trilha acima mostra como se chegou nele.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
