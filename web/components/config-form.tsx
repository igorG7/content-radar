"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ValidationIssue } from "@/lib/config/validate";

export interface ConfigScope {
  key: string;
  label: string;
  sources: string[];
  pillarsAlvo: string[];
}

export interface ConfigData {
  scopes: ConfigScope[];
  candidatesPerWeek: number;
  matchScoreMin: number;
  borderlineMin: number;
  geografiaReframeFloor?: number;
  weights: Record<string, number>;
  warnings: ValidationIssue[];
}

type Edit = { path: (string | number)[]; value: unknown };

export function ConfigForm({ initial }: { initial: ConfigData }) {
  const router = useRouter();
  const [scopes, setScopes] = useState(initial.scopes);
  const [candidatesPerWeek, setCandidatesPerWeek] = useState(initial.candidatesPerWeek);
  const [matchScoreMin, setMatchScoreMin] = useState(initial.matchScoreMin);
  const [borderlineMin, setBorderlineMin] = useState(initial.borderlineMin);
  const [weights, setWeights] = useState(initial.weights);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [saved, setSaved] = useState(false);

  const weightTotal = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  const weightsOff = Math.abs(weightTotal - 1) > 0.001;
  const thresholdOff = borderlineMin >= matchScoreMin;

  function updateSources(key: string, sources: string[]) {
    setScopes((current) =>
      current.map((scope) => (scope.key === key ? { ...scope, sources } : scope)),
    );
  }

  async function save() {
    setBusy(true);
    setIssues([]);
    setSaved(false);

    const edits: Edit[] = [
      { path: ["funnel", "candidates_per_week_target"], value: candidatesPerWeek },
      { path: ["anti_repetition", "match_score_min"], value: matchScoreMin },
      { path: ["anti_repetition", "borderline_min"], value: borderlineMin },
      ...scopes.map((scope) => ({
        path: ["search_scopes", scope.key, "sources"],
        value: scope.sources,
      })),
      ...Object.entries(weights).map(([name, value]) => ({
        path: ["anti_repetition", "match_score_weights", name],
        value,
      })),
    ];

    try {
      const response = await fetch("/api/config", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ edits }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setIssues(payload.errors ?? [{ path: "", message: payload.error ?? "falha ao salvar" }]);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch (error) {
      setIssues([{ path: "", message: (error as Error).message }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-10">
      {initial.warnings.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-[#fff4cf] p-4 text-base text-[#7b4b12]">
          <h2 className="font-medium">Avisos (não impedem salvar)</h2>
          <ul className="mt-2 space-y-1">
            {initial.warnings.map((warning) => (
              <li key={warning.path}>
                <span className="font-mono text-sm">{warning.path}</span> — {warning.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-base font-medium uppercase muted">
          Fontes de pesquisa
        </h2>
        <div className="space-y-4">
          {scopes.map((scope) => (
            <div key={scope.key} className="panel p-5">
              <div className="text-base font-medium">{scope.label}</div>
              <div className="text-sm muted">
                escopo <span className="font-mono">{scope.key}</span>
                {scope.pillarsAlvo.length > 0 && ` · pilares: ${scope.pillarsAlvo.join(", ")}`}
              </div>

              <ul className="mt-3 flex flex-wrap gap-2">
                {scope.sources.map((source) => (
                  <li
                    key={source}
                    className="flex items-center gap-1 pill px-2 py-1 text-sm"
                  >
                    <span className="font-mono">{source}</span>
                    <button
                      type="button"
                      aria-label={`remover ${source}`}
                      onClick={() =>
                        updateSources(
                          scope.key,
                          scope.sources.filter((entry) => entry !== source),
                        )
                      }
                      className="muted hover:text-red-700"
                    >
                      ×
                    </button>
                  </li>
                ))}
                {scope.sources.length === 0 && (
                  <li className="text-sm text-red-700">
                    um escopo precisa de pelo menos uma fonte
                  </li>
                )}
              </ul>

              <form
                className="mt-3 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const value = (draft[scope.key] ?? "").trim();
                  if (!value || scope.sources.includes(value)) return;
                  updateSources(scope.key, [...scope.sources, value]);
                  setDraft((current) => ({ ...current, [scope.key]: "" }));
                }}
              >
                <input
                  value={draft[scope.key] ?? ""}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, [scope.key]: event.target.value }))
                  }
                  placeholder="nova fonte (chave usada pelo researcher)"
                  className="field flex-1 px-2 py-1 text-base"
                />
                <button type="submit" className="button-secondary px-3 text-base">
                  adicionar
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-medium uppercase muted">
          Volume e thresholds
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-base">
            <span className="block text-sm muted">candidatos por semana</span>
            <input
              type="number"
              min={1}
              value={candidatesPerWeek}
              onChange={(event) => setCandidatesPerWeek(Number(event.target.value))}
              className="field mt-1 w-full px-2 py-1"
            />
          </label>
          <label className="text-base">
            <span className="block text-sm muted">match_score_min</span>
            <input
              type="number"
              step={0.01}
              min={0}
              max={1}
              value={matchScoreMin}
              onChange={(event) => setMatchScoreMin(Number(event.target.value))}
              className="field mt-1 w-full px-2 py-1"
            />
          </label>
          <label className="text-base">
            <span className="block text-sm muted">borderline_min</span>
            <input
              type="number"
              step={0.01}
              min={0}
              max={1}
              value={borderlineMin}
              onChange={(event) => setBorderlineMin(Number(event.target.value))}
              className={`field mt-1 w-full px-2 py-1 ${
                thresholdOff ? "border-red-500" : ""
              }`}
            />
          </label>
        </div>
        {thresholdOff && (
          <p className="mt-2 text-base text-red-700">
            borderline_min precisa ficar abaixo de match_score_min, senão o tier borderline some.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-base font-medium uppercase muted">
          Pesos do score
        </h2>
        <p className="mb-3 text-sm muted">
          Precisam somar 1.0 — soma atual:{" "}
          <span className={weightsOff ? "font-medium text-red-700" : "font-medium"}>
            {weightTotal.toFixed(3)}
          </span>
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries(weights).map(([name, value]) => (
            <label key={name} className="text-base">
              <span className="block font-mono text-sm muted">{name}</span>
              <input
                type="number"
                step={0.01}
                min={0}
                max={1}
                value={value}
                onChange={(event) =>
                  setWeights((current) => ({ ...current, [name]: Number(event.target.value) }))
                }
                className="field mt-1 w-full px-2 py-1"
              />
            </label>
          ))}
        </div>
      </section>

      {issues.length > 0 && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-base text-red-950">
          <h2 className="font-medium">Não foi salvo</h2>
          <ul className="mt-2 space-y-1">
            {issues.map((issue, index) => (
              <li key={`${issue.path}-${index}`}>
                {issue.path && <span className="font-mono text-sm">{issue.path} — </span>}
                {issue.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-[#3E5C76]/15 pt-4">
        <button
          type="button"
          disabled={busy || weightsOff || thresholdOff}
          onClick={save}
          className="button-primary px-4 py-2 text-base disabled:cursor-not-allowed disabled:opacity-40"
        >
          Salvar no manifest.yaml
        </button>
        {saved && <span className="text-base text-[var(--text-accent)]">salvo</span>}
        <span className="text-sm muted">
          grava direto no arquivo — o histórico fica no git
        </span>
      </div>
    </div>
  );
}
