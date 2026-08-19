"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { IconAlert, IconX } from "@/components/ui/icons";
import { HANDLE_OK, gravarHandle, useHandle } from "@/lib/session";
import { fmtScore } from "@/lib/format";
import { componentLabel } from "@/lib/view/brief-view";

export interface ConfigEscopo {
  key: string;
  label: string;
  sources: string[];
  pillarsAlvo: string[];
}

export interface ConfigInicial {
  weeklyTarget: number;
  matchScoreMin: number;
  borderlineMin: number;
  weights: Record<string, number>;
  escopos: ConfigEscopo[];
  janelas: { chave: string; dias: number }[];
  /** Score de cada brief no disco — mostra o efeito de mexer no limiar. */
  scores: number[];
  avisos: { path: string; message: string }[];
}

interface Draft {
  weeklyTarget: number;
  matchScoreMin: number;
  borderlineMin: number;
  weights: Record<string, number>;
  escopos: ConfigEscopo[];
}

function draftDe(inicial: ConfigInicial): Draft {
  return {
    weeklyTarget: inicial.weeklyTarget,
    matchScoreMin: inicial.matchScoreMin,
    borderlineMin: inicial.borderlineMin,
    weights: { ...inicial.weights },
    escopos: inicial.escopos.map((e) => ({ ...e, sources: [...e.sources] })),
  };
}

/** A chave do YAML vem do arquivo; o domínio digitado vira slug com ponto. */
function slugFonte(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9./-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function ConfigClient({ inicial }: { inicial: ConfigInicial }) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(() => draftDe(inicial));
  const [diffAberto, setDiffAberto] = useState(false);
  const [gravando, setGravando] = useState(false);

  // O @ vem do navegador; enquanto ninguém edita, o campo mostra o gravado.
  const handleSalvo = useHandle();
  const [handleEditado, setHandleEditado] = useState<string | null>(null);
  const handle = handleEditado ?? handleSalvo;

  const soma = Object.values(draft.weights).reduce((a, b) => a + b, 0);
  const somaOk = Math.abs(soma - 1) < 0.0005;

  const problemas = useMemo(() => {
    const out: string[] = [];
    if (!somaOk)
      out.push(
        `Os pesos somam ${soma.toFixed(3).replace(".", ",")} — o backend exige exatamente 1,000.`,
      );
    if (draft.borderlineMin >= draft.matchScoreMin)
      out.push(
        `borderline_min (${fmtScore(draft.borderlineMin)}) precisa ser menor que match_score_min (${fmtScore(draft.matchScoreMin)}), senão a faixa borderline some.`,
      );
    if (draft.weeklyTarget < 1)
      out.push("A meta semanal precisa ser pelo menos 1.");
    for (const escopo of draft.escopos) {
      if (!escopo.label.trim())
        out.push(`O grupo "${escopo.key}" está sem rótulo.`);
      if (escopo.sources.length === 0)
        out.push(
          `O grupo "${escopo.key}" ficou sem nenhuma fonte — o zod da API exige ao menos 1.`,
        );
      if (escopo.sources.some((s) => !s.trim()))
        out.push(`O grupo "${escopo.key}" tem fonte em branco.`);
      const repetidas = escopo.sources.filter(
        (s, i) => escopo.sources.indexOf(s) !== i,
      );
      if (repetidas.length > 0)
        out.push(
          `O grupo "${escopo.key}" repete fontes: ${[...new Set(repetidas)].join(", ")}.`,
        );
    }
    if (!HANDLE_OK.test(handle))
      out.push(
        "O @ do Instagram aceita até 30 caracteres entre letras, números, ponto e underscore — sem o “@” e sem espaços.",
      );
    return out;
  }, [draft, handle, soma, somaOk]);

  const edits = useMemo(() => {
    const lista: {
      path: (string | number)[];
      value: unknown;
      rotulo: string;
      antes: string;
    }[] = [];
    if (draft.weeklyTarget !== inicial.weeklyTarget) {
      lista.push({
        path: ["funnel", "candidates_per_week_target"],
        value: draft.weeklyTarget,
        rotulo: "funnel.candidates_per_week_target",
        antes: String(inicial.weeklyTarget),
      });
    }
    if (draft.matchScoreMin !== inicial.matchScoreMin) {
      lista.push({
        path: ["anti_repetition", "match_score_min"],
        value: draft.matchScoreMin,
        rotulo: "anti_repetition.match_score_min",
        antes: String(inicial.matchScoreMin),
      });
    }
    if (draft.borderlineMin !== inicial.borderlineMin) {
      lista.push({
        path: ["anti_repetition", "borderline_min"],
        value: draft.borderlineMin,
        rotulo: "anti_repetition.borderline_min",
        antes: String(inicial.borderlineMin),
      });
    }
    for (const [chave, peso] of Object.entries(draft.weights)) {
      if (peso !== inicial.weights[chave]) {
        lista.push({
          path: ["anti_repetition", "match_score_weights", chave],
          value: peso,
          rotulo: `anti_repetition.match_score_weights.${chave}`,
          antes: String(inicial.weights[chave]),
        });
      }
    }
    for (const escopo of draft.escopos) {
      const antes = inicial.escopos.find((e) => e.key === escopo.key);
      if (!antes) continue;
      if (escopo.label !== antes.label) {
        lista.push({
          path: ["search_scopes", escopo.key, "label"],
          value: escopo.label,
          rotulo: `search_scopes.${escopo.key}.label`,
          antes: antes.label,
        });
      }
      if (escopo.sources.join("|") !== antes.sources.join("|")) {
        lista.push({
          path: ["search_scopes", escopo.key, "sources"],
          value: escopo.sources,
          rotulo: `search_scopes.${escopo.key}.sources`,
          antes: antes.sources.join(", "),
        });
      }
    }
    return lista;
  }, [draft, inicial]);

  const sujo = edits.length > 0;

  const impacto = useMemo(() => {
    const total = inicial.scores.length;
    const passa = inicial.scores.filter((s) => s >= draft.matchScoreMin).length;
    const border = inicial.scores.filter(
      (s) => s >= draft.borderlineMin && s < draft.matchScoreMin,
    ).length;
    return { total, passa, border, fora: total - passa - border };
  }, [draft.borderlineMin, draft.matchScoreMin, inicial.scores]);

  function normalizar() {
    if (soma === 0) return;
    const proximo: Record<string, number> = {};
    for (const [chave, peso] of Object.entries(draft.weights)) {
      proximo[chave] = Math.round((peso / soma) * 100) / 100;
    }
    const resto =
      Math.round(
        (1 - Object.values(proximo).reduce((a, b) => a + b, 0)) * 100,
      ) / 100;
    const maior = Object.keys(proximo).sort(
      (a, b) => proximo[b] - proximo[a],
    )[0];
    proximo[maior] = Math.round((proximo[maior] + resto) * 100) / 100;
    setDraft((d) => ({ ...d, weights: proximo }));
  }

  async function gravar() {
    if (problemas.length > 0) {
      toast({
        tone: "danger",
        title: "HTTP 422 · MANIFEST_INVALID",
        detail: problemas[0],
      });
      return;
    }
    gravarHandle(handle);

    if (edits.length === 0) {
      toast({
        title: "Nada a gravar no manifest",
        detail: "Só o @ do Instagram mudou.",
      });
      return;
    }

    setGravando(true);
    const resposta = await fetch("/api/config", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        edits: edits.map(({ path, value }) => ({ path, value })),
      }),
    }).catch(() => null);
    const corpo = await resposta?.json().catch(() => null);
    setGravando(false);

    if (!resposta?.ok) {
      toast({
        tone: "danger",
        title: `HTTP ${resposta?.status ?? "—"} · MANIFEST_INVALID`,
        detail:
          corpo?.errors?.[0]?.message ??
          corpo?.error ??
          "A API recusou o patch; nada foi escrito.",
      });
      return;
    }

    setDiffAberto(false);
    toast({
      tone: "ok",
      title: "manifest.yaml gravado",
      detail:
        "Patch aplicado preservando os comentários. A próxima varredura já usa estes valores.",
    });
    router.refresh();
  }

  return (
    <>
      {inicial.avisos.map((aviso) => (
        <div
          className="alert alert-warning"
          style={{ marginBottom: 12 }}
          key={aviso.path}
        >
          <IconAlert />
          <div className="alert-body">
            <strong>{aviso.path}</strong>
            <p className="small" style={{ marginTop: 3 }}>
              {aviso.message}
            </p>
          </div>
        </div>
      ))}

      <form
        className="grid-main"
        onSubmit={(event) => {
          event.preventDefault();
          setDiffAberto(true);
        }}
      >
        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2 className="h3">Ritmo editorial</h2>
              <span className="meta">funnel.candidates_per_week_target</span>
            </div>
            <div className="panel-body">
              <div className="field" style={{ maxWidth: 220 }}>
                <label htmlFor="meta">Candidatos gerados por semana</label>
                <input
                  className="input num"
                  type="number"
                  id="meta"
                  min={1}
                  max={40}
                  value={draft.weeklyTarget}
                  onChange={(event) =>
                    setDraft((d) => ({
                      ...d,
                      weeklyTarget: Number(event.target.value) || 0,
                    }))
                  }
                />
                <p className="field-help">
                  Alvo de geração, não cadência de publicação. A varredura não
                  para ao atingir.
                </p>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2 className="h3">Perfil que publica</h2>
              <span className="meta">local — não vive no manifest</span>
            </div>
            <div className="panel-body">
              <div
                className={`field ${HANDLE_OK.test(handle) ? "" : "field-invalid"}`}
                style={{ maxWidth: 320 }}
              >
                <label htmlFor="handle">@ do Instagram</label>
                <div className="input-prefixed">
                  <span aria-hidden="true">@</span>
                  <input
                    className="input"
                    id="handle"
                    value={handle}
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={30}
                    onChange={(event) =>
                      setHandleEditado(
                        event.target.value
                          .trim()
                          .replace(/^@+/, "")
                          .toLowerCase(),
                      )
                    }
                  />
                </div>
                {HANDLE_OK.test(handle) ? (
                  <p className="field-help">
                    Usado no cabeçalho e na legenda da prévia do post, em todas
                    as telas. Fica no navegador — o manifest não tem essa chave.
                  </p>
                ) : (
                  <p className="field-error">
                    Letras, números, ponto e underscore — até 30 caracteres, sem
                    o “@”.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2 className="h3">Limiares de score</h2>
              <span className="meta">
                anti_repetition.match_score_min · borderline_min
              </span>
            </div>
            <div className="panel-body stack">
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="min">match_score_min</label>
                  <input
                    className="input num"
                    type="number"
                    id="min"
                    step="0.01"
                    min={0}
                    max={1}
                    value={draft.matchScoreMin}
                    onChange={(event) =>
                      setDraft((d) => ({
                        ...d,
                        matchScoreMin: Math.min(
                          1,
                          Math.max(0, Number(event.target.value) || 0),
                        ),
                      }))
                    }
                  />
                  <p className="field-help">
                    Acima disso entra na fila direto.
                  </p>
                </div>
                <div
                  className={`field ${draft.borderlineMin >= draft.matchScoreMin ? "field-invalid" : ""}`}
                >
                  <label htmlFor="bmin">borderline_min</label>
                  <input
                    className="input num"
                    type="number"
                    id="bmin"
                    step="0.01"
                    min={0}
                    max={1}
                    value={draft.borderlineMin}
                    onChange={(event) =>
                      setDraft((d) => ({
                        ...d,
                        borderlineMin: Math.min(
                          1,
                          Math.max(0, Number(event.target.value) || 0),
                        ),
                      }))
                    }
                  />
                  <p className="field-help">
                    Entre os dois valores, o brief chega marcado como borderline
                    para você decidir.
                  </p>
                </div>
              </div>
              <div className="sunken">
                <p className="field-label">
                  Efeito sobre os {impacto.total} briefs já no disco
                </p>
                <div
                  className="score-bar"
                  style={{ marginTop: 9, height: 14 }}
                  role="img"
                  aria-label={`${impacto.passa} entram direto, ${impacto.border} borderline, ${impacto.fora} descartados`}
                >
                  <div
                    className="score-seg score-seg-1"
                    style={{
                      width: `${impacto.total ? (impacto.passa / impacto.total) * 100 : 0}%`,
                    }}
                  />
                  <div
                    className="score-seg score-seg-3"
                    style={{
                      width: `${impacto.total ? (impacto.border / impacto.total) * 100 : 0}%`,
                    }}
                  />
                  <div
                    className="score-seg score-seg-5"
                    style={{
                      width: `${impacto.total ? (impacto.fora / impacto.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="row" style={{ marginTop: 9, gap: 16 }}>
                  <span className="small">
                    <span className="num strong">{impacto.passa}</span> entram
                    direto
                  </span>
                  <span className="small">
                    <span className="num strong">{impacto.border}</span>{" "}
                    borderline
                  </span>
                  <span className="small muted">
                    <span className="num">{impacto.fora}</span> ficariam de fora
                  </span>
                </div>
                <p className="field-help" style={{ marginTop: 8 }}>
                  Leitura retroativa: o limiar novo só vale para a próxima
                  varredura, o que já está no disco não é reclassificado.
                </p>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2 className="h3">Pesos do score</h2>
              <span className="meta">
                match_score_weights · precisa somar 1,000
              </span>
            </div>
            <div className="panel-body stack-sm">
              {Object.entries(draft.weights).map(([chave, peso]) => (
                <div className="peso-row" key={chave}>
                  <label className="small" htmlFor={`w-${chave}`}>
                    {componentLabel(chave)}
                    <br />
                    <span className="meta">{chave}</span>
                  </label>
                  <input
                    type="range"
                    id={`w-${chave}`}
                    min={0}
                    max={0.6}
                    step={0.01}
                    value={peso}
                    aria-label={`Peso de ${componentLabel(chave)}`}
                    onChange={(event) =>
                      setDraft((d) => ({
                        ...d,
                        weights: {
                          ...d.weights,
                          [chave]: Number(event.target.value),
                        },
                      }))
                    }
                  />
                  <input
                    className="input num"
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={peso}
                    aria-label={`Peso numérico de ${componentLabel(chave)}`}
                    onChange={(event) =>
                      setDraft((d) => ({
                        ...d,
                        weights: {
                          ...d.weights,
                          [chave]: Math.min(
                            1,
                            Math.max(0, Number(event.target.value) || 0),
                          ),
                        },
                      }))
                    }
                  />
                </div>
              ))}
              <div
                className={`soma-box ${somaOk ? "is-ok" : "is-bad"}`}
                aria-live="polite"
              >
                <span className="small strong">
                  Soma:{" "}
                  <span className="num">
                    {soma.toFixed(3).replace(".", ",")}
                  </span>
                </span>
                <span className="row-tight">
                  <span className="small">
                    {somaOk
                      ? "pronto para gravar"
                      : `faltam ${(1 - soma).toFixed(3).replace(".", ",")} para 1,000`}
                  </span>
                  {!somaOk && (
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      onClick={normalizar}
                    >
                      Normalizar
                    </button>
                  )}
                </span>
              </div>
              <p className="field-help">
                O backend rejeita a gravação se a soma não for exata. Antecipar
                isso aqui evita perder a edição num 422.
              </p>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2 className="h3">Grupos de fontes</h2>
              <span className="meta">search_scopes</span>
            </div>
            <div className="panel-body stack-sm">
              <p className="field-help" style={{ marginBottom: 4 }}>
                Um grupo é um conjunto de fontes que a varredura usa junto, com
                os pilares que ele alimenta. Criar ou remover grupo é edição à
                mão no arquivo: o patch da API só reescreve caminho que já
                existe.
              </p>
              {draft.escopos.map((escopo, ei) => (
                <div className="escopo" key={escopo.key}>
                  <div className="grupo-head">
                    <span className="meta" title="Chave no YAML">
                      {escopo.key}
                    </span>
                    <input
                      className="input"
                      value={escopo.label}
                      placeholder="Rótulo do grupo"
                      aria-label={`Rótulo do grupo ${escopo.key}`}
                      onChange={(event) =>
                        setDraft((d) => {
                          const escopos = [...d.escopos];
                          escopos[ei] = {
                            ...escopos[ei],
                            label: event.target.value,
                          };
                          return { ...d, escopos };
                        })
                      }
                    />
                    <span className="pill pill-bare">
                      {escopo.sources.length} fontes
                    </span>
                    <span className="meta">
                      {escopo.pillarsAlvo.join(" · ") || "sem pilar alvo"}
                    </span>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    {escopo.sources.length > 0 ? (
                      escopo.sources.map((fonte, fi) => (
                        <div className="fonte-row" key={`${escopo.key}-${fi}`}>
                          <input
                            className="input num"
                            value={fonte}
                            placeholder="chave-da-fonte"
                            aria-label={`Fonte ${fi + 1} do grupo ${escopo.key}`}
                            onChange={(event) =>
                              setDraft((d) => {
                                const escopos = [...d.escopos];
                                const sources = [...escopos[ei].sources];
                                sources[fi] = slugFonte(event.target.value);
                                escopos[ei] = { ...escopos[ei], sources };
                                return { ...d, escopos };
                              })
                            }
                          />
                          <button
                            className="btn btn-danger btn-sm btn-icon"
                            type="button"
                            aria-label={`Remover a fonte ${fonte}`}
                            onClick={() =>
                              setDraft((d) => {
                                const escopos = [...d.escopos];
                                escopos[ei] = {
                                  ...escopos[ei],
                                  sources: escopos[ei].sources.filter(
                                    (_, j) => j !== fi,
                                  ),
                                };
                                return { ...d, escopos };
                              })
                            }
                          >
                            <IconX />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="field-help">
                        Nenhuma fonte neste grupo — a API recusa gravar um grupo
                        vazio.
                      </p>
                    )}
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    style={{ marginTop: 10 }}
                    onClick={() =>
                      setDraft((d) => {
                        const escopos = [...d.escopos];
                        escopos[ei] = {
                          ...escopos[ei],
                          sources: [...escopos[ei].sources, ""],
                        };
                        return { ...d, escopos };
                      })
                    }
                  >
                    + Adicionar fonte
                  </button>
                </div>
              ))}
            </div>
          </section>

          <div className="savebar">
            <p className="small" aria-live="polite">
              {problemas.length > 0 ? (
                <span className="strong" style={{ color: "var(--danger)" }}>
                  {problemas.length} problema(s) bloqueiam a gravação
                </span>
              ) : sujo ? (
                <span className="strong" style={{ color: "var(--warn)" }}>
                  Alterações não gravadas
                </span>
              ) : (
                <span className="muted">manifest.yaml igual ao disco</span>
              )}
            </p>
            <div className="row-tight">
              <button
                className="btn btn-secondary"
                type="button"
                disabled={!sujo}
                onClick={() => setDiffAberto(true)}
              >
                Ver o diff
              </button>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={problemas.length > 0 || gravando}
              >
                {gravando ? "Gravando…" : "Gravar manifest.yaml"}
              </button>
            </div>
          </div>
        </div>

        <div className="stack sticky-side">
          {problemas.length > 0 && (
            <div
              className="panel"
              style={{
                borderColor:
                  "color-mix(in oklch, var(--danger) 40%, transparent)",
              }}
            >
              <div className="panel-head">
                <h2 className="h3">Bloqueios</h2>
              </div>
              <div className="panel-body stack-sm">
                {problemas.map((problema) => (
                  <p
                    className="small"
                    style={{ color: "var(--danger)" }}
                    key={problema}
                  >
                    {problema}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="panel">
            <div className="panel-head">
              <h2 className="h3">Trecho do arquivo</h2>
              <span className="meta">manifest.yaml</span>
            </div>
            <div className="panel-body" style={{ padding: 12 }}>
              <pre className="code code-wrap">
                <span className="c-com"># alvo de geração da semana</span>
                {"\n"}
                <span className="c-key">funnel</span>:{"\n"}{" "}
                <span className="c-key">candidates_per_week_target</span>:{" "}
                {draft.weeklyTarget}
                {"\n\n"}
                <span className="c-key">anti_repetition</span>:{"\n"}{" "}
                <span className="c-key">match_score_min</span>:{" "}
                {draft.matchScoreMin}
                {"\n"} <span className="c-key">borderline_min</span>:{" "}
                {draft.borderlineMin}{" "}
                <span className="c-com"># abaixo, descarta</span>
                {"\n"} <span className="c-key">match_score_weights</span>:{"\n"}
                {Object.entries(draft.weights).map(([chave, peso]) => (
                  <span key={chave}>
                    {"    "}
                    <span className="c-key">{chave}</span>: {peso.toFixed(2)}
                    {"\n"}
                  </span>
                ))}
              </pre>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2 className="h3">Anti-repetição</h2>
            </div>
            <div className="panel-body">
              <dl className="json-view">
                {inicial.janelas.map((janela) => (
                  <div className="json-row" key={janela.chave}>
                    <span className="json-key">{janela.chave}</span>
                    <span className="json-val">{janela.dias} dias</span>
                  </div>
                ))}
              </dl>
              <p className="field-help" style={{ marginTop: 10 }}>
                Editar essas chaves ainda é feito à mão no arquivo — a API de
                patch cobre scoring, funil e fontes.
              </p>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2 className="h3">Vocabulário editorial</h2>
            </div>
            <div className="panel-body">
              <p className="small">
                Pilares, públicos, voz e guardrails não moram aqui: eles são
                prosa e vivem na aba{" "}
                <Link className="link" href="/config/vault">
                  Vault
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </form>

      <Modal
        open={diffAberto}
        onClose={() => setDiffAberto(false)}
        wide
        eyebrow="manifest.yaml"
        title="Diff antes de gravar"
        footer={
          <>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setDiffAberto(false)}
            >
              Voltar
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={gravando || problemas.length > 0}
              onClick={() => void gravar()}
            >
              {gravando ? "Gravando…" : "Gravar agora"}
            </button>
          </>
        }
      >
        <p className="small">
          O patch é cirúrgico: cada linha abaixo vira um{" "}
          <span className="num">{"{path, value}"}</span> em{" "}
          <span className="num">PATCH /api/config</span>. Comentários, ordem das
          chaves e formatação do resto do arquivo ficam intactos.
        </p>
        <pre className="code" style={{ marginTop: 14, whiteSpace: "pre-wrap" }}>
          {edits.length > 0 ? (
            edits.map((edit) => (
              <span key={edit.rotulo}>
                <span className="c-del">
                  - {edit.rotulo}: {edit.antes}
                </span>
                <span className="c-add">
                  + {edit.rotulo}:{" "}
                  {Array.isArray(edit.value)
                    ? (edit.value as string[]).join(", ")
                    : String(edit.value)}
                </span>
              </span>
            ))
          ) : (
            <span className="c-com">sem alterações no manifest</span>
          )}
        </pre>
        <p className="field-help" style={{ marginTop: 12 }}>
          Este arquivo governa todo o pipeline. Uma varredura em curso continua
          com a configuração antiga; a próxima já usa a nova.
        </p>
      </Modal>
    </>
  );
}
