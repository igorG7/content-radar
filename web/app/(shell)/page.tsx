import Link from "next/link";
import { PipelineGate } from "@/components/pipeline-gate";
import { IconAlert } from "@/components/ui/icons";
import { fmtRelative, fmtScore, weekLabel, weekOf } from "@/lib/format";
import type { BriefState } from "@/lib/manifest";
import { radarStore } from "@/lib/store";
import { EVENT_TONE, eventLabel } from "@/lib/view/ledger-view";
import { scoringOf, toBriefView, type BriefView } from "@/lib/view/brief-view";

export const dynamic = "force-dynamic";

const CONTADORES: { state: BriefState; label: string; href: string }[] = [
  { state: "pendente-aprovacao", label: "na fila de aprovação", href: "/fila" },
  { state: "pendente-publicacao", label: "aguardando publicação", href: "/acervo?estado=pendente-publicacao" },
  { state: "publicado", label: "publicados", href: "/acervo?estado=publicado" },
  { state: "rejeitado", label: "rejeitados", href: "/acervo?estado=rejeitado" },
];

/** Dias desde a data, para a meta da semana e para a última varredura. */
function diasDesde(iso: string | null | undefined): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  return (Date.now() - new Date(iso).getTime()) / 86400000;
}

function Saude({
  itens,
}: {
  itens: [string, string, "ok" | "warn" | "danger"][];
}) {
  return (
    <>
      {itens.map(([chave, valor, tone]) => (
        <div className="row-between" style={{ gap: 10, alignItems: "flex-start" }} key={chave}>
          <span className="small">{chave}</span>
          <span className="row-tight" style={{ justifyContent: "flex-end", flex: "0 1 auto" }}>
            <span className="meta" style={{ textAlign: "right" }}>
              {valor}
            </span>
            <span
              className={`pill pill-${tone} pill-bare`}
              style={{ width: 8, height: 8, padding: 0, borderRadius: "50%" }}
              aria-hidden="true"
            />
          </span>
        </div>
      ))}
    </>
  );
}

export default async function Painel() {
  const store = radarStore();
  const [manifest, listings, ledger] = await Promise.all([
    store.manifest(),
    store.listarTodos(),
    store.lerLedger(),
  ]);

  const scoring = scoringOf(manifest);
  const porEstado = new Map<BriefState, BriefView[]>(
    listings.map((l) => [l.state, l.briefs.map((b) => toBriefView(b, scoring))]),
  );
  const falhas = listings.flatMap((l) => l.failures);
  const total = [...porEstado.values()].reduce((n, list) => n + list.length, 0);

  const fila = porEstado.get("pendente-aprovacao") ?? [];
  const meta = manifest.funnel.candidates_per_week_target;
  const aprovadosNaSemana = [...porEstado.values()]
    .flat()
    .filter((b) => diasDesde(b.approvedAt) <= 7).length;

  const midiasAusentes = fila.reduce((n, b) => n + b.media.filter((m) => m.missing).length, 0);
  const briefsComMidiaAusente = fila.filter((b) => b.media.some((m) => m.missing)).length;
  const semLicenca = fila.filter((b) => b.media.some((m) => m.licensable === false)).length;
  const borderline = fila.filter((b) => b.borderline).length;
  const semArte = fila.filter((b) => !b.heroChoiceDeclared).length;

  const eventos = [...ledger.events].reverse();
  const ultimaVarredura = eventos.find((e) => e.event === "scan-finished");
  const semana = fila[0] ? weekOf(fila[0].briefId) : weekOf(eventos[0]?.brief_id ?? "");

  const previa = [...fila]
    .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
    .slice(0, 6);

  const pct = meta > 0 ? Math.min(100, Math.round((aprovadosNaSemana / meta) * 100)) : 0;

  return (
    <PipelineGate variant="painel">
      <div>
        <div className="page-head">
          <div className="row-between">
            <div>
              <p className="eyebrow">
                {semana === "sem-semana" ? "painel editorial" : `${weekLabel(semana)} · painel editorial`}
              </p>
              <h1 className="display" style={{ marginTop: 8 }}>
                {fila.length} {fila.length === 1 ? "pauta esperando" : "pautas esperando"} sua decisão
              </h1>
              <p className="lead">
                Fonte da verdade é o filesystem: {total} briefs em{" "}
                <span className="num">store/briefs/</span>, {ledger.events.length} eventos no
                ledger. Nenhum banco de dados no caminho.
              </p>
            </div>
            <Link className="btn btn-primary" href="/fila">
              Abrir a fila
            </Link>
          </div>
        </div>

        <div className="grid-4">
          {CONTADORES.map((c) => (
            <Link
              className={`counter-card${c.state === "pendente-aprovacao" ? " is-active" : ""}`}
              href={c.href}
              key={c.state}
            >
              <div className="counter-num">{porEstado.get(c.state)?.length ?? 0}</div>
              <div className="counter-label">{c.label}</div>
            </Link>
          ))}
        </div>

        <div className="grid-main" style={{ marginTop: 32 }}>
          <div className="stack">
            <div className="panel">
              <div className="panel-head">
                <h2 className="h3">
                  Prévia da fila{" "}
                  <span className="meta">
                    {previa.length} de {fila.length}, por score
                  </span>
                </h2>
                <Link className="btn btn-ghost btn-sm" href="/fila">
                  Ver todas →
                </Link>
              </div>
              <div className="panel-body-flush">
                {previa.length === 0 && (
                  <p className="small muted" style={{ padding: 18 }}>
                    Nada pendente de aprovação. A próxima varredura escreve direto em{" "}
                    <span className="num">store/briefs/pendente-aprovacao/</span>.
                  </p>
                )}
                {previa.map((b) => (
                  <article
                    className={`brief-row${b.borderline ? " is-borderline" : ""}`}
                    style={{ gridTemplateColumns: "74px minmax(0,1fr) auto" }}
                    key={b.slug}
                  >
                    <div>
                      <div className="num strong" style={{ fontSize: 17 }}>
                        {b.matchScore === null ? "—" : fmtScore(b.matchScore)}
                      </div>
                      <div className="meta" style={{ marginTop: 2 }}>
                        {b.briefId.slice(-3)}
                      </div>
                    </div>
                    <div>
                      <h3 className="brief-headline">
                        <Link href={`/briefs/${b.state}/${b.slug}`}>{b.headline}</Link>
                      </h3>
                      <p className="brief-hook clamp-2">{b.hook}</p>
                      <div className="row-tight" style={{ marginTop: 9 }}>
                        {b.pilar && <span className="tag">{b.pilar}</span>}
                        {b.icp && <span className="tag">{b.icp}</span>}
                        {b.borderline && <span className="pill pill-warn">borderline</span>}
                        {b.warnings.length > 0 && (
                          <span className="pill pill-danger" title={b.warnings.join(" · ")}>
                            {b.warnings.length} aviso{b.warnings.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <Link className="btn btn-secondary btn-sm" href={`/fila#${b.slug}`}>
                      Revisar
                    </Link>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="stack">
            <div className="panel">
              <div className="panel-head">
                <h2 className="h3">Saúde do fluxo</h2>
              </div>
              <div className="panel-body">
                <div className="stack-sm">
                  <div>
                    <div className="row-between" style={{ gap: 8 }}>
                      <span className="field-label">Meta da semana</span>
                      <span className="num small">
                        <span className="strong">{aprovadosNaSemana}</span> / {meta} aprovados
                      </span>
                    </div>
                    <div
                      className="score-bar"
                      style={{ marginTop: 7 }}
                      role="img"
                      aria-label={`${aprovadosNaSemana} de ${meta} aprovados nesta semana`}
                    >
                      <div className="score-seg score-seg-1" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="meta" style={{ marginTop: 6 }}>
                      {aprovadosNaSemana >= meta
                        ? "Meta da semana fechada."
                        : `Faltam ${meta - aprovadosNaSemana} aprovações para fechar a semana.`}
                    </p>
                  </div>
                  <hr className="rule" />
                  <Saude
                    itens={[
                      [
                        "Última varredura",
                        ultimaVarredura ? fmtRelative(ultimaVarredura.ts) : "sem registro no ledger",
                        ultimaVarredura ? "ok" : "warn",
                      ],
                      [
                        "Decisões borderline esperando",
                        `${borderline} brief${borderline === 1 ? "" : "s"} entre ${scoring.borderlineMin} e ${scoring.matchScoreMin}`,
                        borderline ? "warn" : "ok",
                      ],
                      [
                        "Arte ainda não decidida",
                        `${semArte} de ${fila.length} sem hero_choice`,
                        semArte ? "warn" : "ok",
                      ],
                      [
                        "Mídia ausente do cache",
                        `${midiasAusentes} arquivo(s) em ${briefsComMidiaAusente} brief(s)`,
                        midiasAusentes ? "warn" : "ok",
                      ],
                      [
                        "Mídia sem licença comercial",
                        `${semLicenca} brief(s) com candidata de imprensa`,
                        semLicenca ? "danger" : "ok",
                      ],
                      [
                        "ledger.jsonl",
                        ledger.malformedLines.length
                          ? `${ledger.malformedLines.length} linha(s) ilegíveis`
                          : `${ledger.events.length} eventos, todos legíveis`,
                        ledger.malformedLines.length ? "danger" : "ok",
                      ],
                    ]}
                  />
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <h2 className="h3">Ledger</h2>
                <Link className="btn btn-ghost btn-sm" href="/ledger">
                  Auditoria →
                </Link>
              </div>
              <div className="panel-body">
                <div className="timeline">
                  {eventos.slice(0, 8).map((evento, index) => {
                    const tone = EVENT_TONE[evento.event] ?? "";
                    return (
                      <div className="timeline-item" key={`${evento.ts}-${index}`}>
                        <div className="timeline-rail">
                          <span className={`timeline-dot${tone ? ` is-${tone}` : ""}`} />
                          <span className="timeline-line" />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div className="row-tight" style={{ gap: 7 }}>
                            <span className="small strong">{eventLabel(evento.event)}</span>
                            {evento.brief_id && (
                              <Link className="meta link" href={`/ledger?brief=${evento.brief_id}`}>
                                {evento.brief_id}
                              </Link>
                            )}
                          </div>
                          <p className="meta" style={{ marginTop: 2 }}>
                            {evento.actor ?? "—"}
                            <span className="dot-sep" />
                            {fmtRelative(evento.ts)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {falhas.length > 0 && (
              <div
                className="panel"
                style={{ borderColor: "color-mix(in oklch, var(--danger) 35%, transparent)" }}
              >
                <div className="panel-head">
                  <h2 className="h3">
                    Briefs ilegíveis <span className="pill pill-danger">{falhas.length}</span>
                  </h2>
                </div>
                <div className="panel-body stack-sm">
                  {falhas.map((falha) => (
                    <div key={falha.filePath}>
                      <p className="meta" style={{ color: "var(--fg-2)" }}>
                        {falha.filePath}
                      </p>
                      <p className="small" style={{ color: "var(--danger)", marginTop: 3 }}>
                        {falha.message}
                      </p>
                    </div>
                  ))}
                  <p className="field-help">
                    O arquivo continua no disco e não entra em nenhuma contagem. Corrigir o
                    frontmatter à mão o traz de volta à fila.
                  </p>
                </div>
              </div>
            )}

            {ledger.malformedLines.length > 0 && (
              <div className="alert alert-warning">
                <IconAlert />
                <div className="alert-body">
                  <strong>{ledger.malformedLines.length} linha(s) do ledger não parseiam</strong>
                  <p className="small" style={{ marginTop: 3 }}>
                    Linhas {ledger.malformedLines.join(", ")} de{" "}
                    <span className="num">store/ledger.jsonl</span>. O arquivo é append-only: nada
                    foi reescrito, só ignorado na leitura.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PipelineGate>
  );
}
