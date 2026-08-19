import { fmtPct, fmtScore } from "@/lib/format";
import type { ScoreComponent } from "@/lib/view/brief-view";

interface ScoreBarProps {
  score: number | null;
  breakdown: ScoreComponent[];
  min: number;
  borderline?: boolean;
  legend?: boolean;
}

/**
 * O espaço que sobra até 1,0 continua sendo trilho: a barra lê como "quanto do
 * máximo este brief realmente ganhou", não como uma pilha normalizada em 100%.
 */
export function ScoreBar({
  score,
  breakdown,
  min,
  borderline,
  legend = true,
}: ScoreBarProps) {
  const segmentos = breakdown.map((c, i) => (
    <div
      key={c.key}
      className={`score-seg score-seg-${i + 1}`}
      style={{ width: `${(c.value * 100).toFixed(2)}%` }}
      title={`${c.label}: ${fmtPct(c.raw)} × peso ${String(c.weight).replace(".", ",")} = ${fmtScore(c.value)}`}
    />
  ));

  return (
    <>
      <div className="score-head">
        <span className="score-value num">
          {score === null ? "—" : fmtScore(score)}
        </span>
        <span className="meta">de 1,000 · corte {fmtScore(min)}</span>
        {borderline && <span className="pill pill-warn">borderline</span>}
      </div>
      <div
        className="score-bar"
        role="img"
        style={{ marginTop: 8 }}
        aria-label={`Composição do score: ${breakdown
          .map((c) => `${c.label} ${fmtScore(c.value)}`)
          .join(", ")}`}
      >
        {segmentos}
      </div>
      <div className="score-threshold">
        <span style={{ left: `${min * 100}%` }}>corte {fmtScore(min)}</span>
      </div>
      {legend && (
        <div className="score-legend">
          {breakdown.map((c, i) => (
            <div className="score-legend-row" key={c.key}>
              <span className={`score-swatch score-seg-${i + 1}`} />
              <span>{c.label}</span>
              <span className="num muted">
                {fmtPct(c.raw)} × {String(c.weight).replace(".", ",")}
              </span>
              <span className="num strong">{fmtScore(c.value)}</span>
              {c.hint && <span className="hint">{c.hint}</span>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** Versão compacta da fila: só as faixas, sem cabeçalho nem legenda. */
export function ScoreStrip({
  breakdown,
  score,
}: {
  breakdown: ScoreComponent[];
  score: number | null;
}) {
  return (
    <div
      className="score-bar"
      role="img"
      aria-label={`Score ${score === null ? "ausente" : fmtScore(score)} de 1,000`}
    >
      {breakdown.map((c, i) => (
        <div
          key={c.key}
          className={`score-seg score-seg-${i + 1}`}
          style={{ width: `${(c.value * 100).toFixed(2)}%` }}
        />
      ))}
    </div>
  );
}
