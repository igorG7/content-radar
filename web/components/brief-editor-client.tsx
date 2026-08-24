"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { IgPreview, IG_CUT } from "@/components/ui/ig-preview";
import { Counter, Crumb, LIMITES } from "@/components/ui/pieces";
import { IconAlert, IconX } from "@/components/ui/icons";
import type { BriefView } from "@/lib/view/brief-view";
import { STATE_META } from "@/lib/view/brief-view";

interface Draft {
  headline: string;
  hook: string;
  caption: string;
  cta: string;
  hashtags: string[];
  mustHave: string[];
  avoidVisual: string[];
  aspectRatio: string;
}

function draftDe(brief: BriefView): Draft {
  return {
    headline: brief.headline,
    hook: brief.hook,
    caption: brief.caption,
    cta: brief.cta,
    hashtags: [...brief.hashtags],
    mustHave: [...brief.visualBrief.mustHave],
    avoidVisual: [...brief.visualBrief.avoidVisual],
    aspectRatio: brief.visualBrief.aspectRatio,
  };
}

type Campo = "headline" | "hook" | "caption" | "hashtags";

/** Lista ordenável de itens do visual_brief — a ordem é significativa. */
function ListEditor({
  titulo,
  ajuda,
  itens,
  onChange,
}: {
  titulo: string;
  ajuda: string;
  itens: string[];
  onChange: (proximo: string[]) => void;
}) {
  return (
    <div className="field">
      <div className="row-between">
        <span className="field-label">{titulo}</span>
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          onClick={() => onChange([...itens, ""])}
        >
          + Adicionar
        </button>
      </div>
      <div className="list-editor">
        {itens.length > 0 ? (
          itens.map((valor, i) => (
            <div className="list-item" key={`${titulo}-${i}`}>
              <input
                className="input"
                value={valor}
                aria-label={`${titulo} item ${i + 1}`}
                onChange={(event) => {
                  const proximo = [...itens];
                  proximo[i] = event.target.value;
                  onChange(proximo);
                }}
              />
              <span className="row-tight" style={{ flexWrap: "nowrap" }}>
                <button
                  className="btn btn-secondary btn-sm btn-icon"
                  type="button"
                  disabled={i === 0}
                  aria-label={`Mover item ${i + 1} para cima`}
                  onClick={() => {
                    const proximo = [...itens];
                    [proximo[i - 1], proximo[i]] = [proximo[i], proximo[i - 1]];
                    onChange(proximo);
                  }}
                >
                  ↑
                </button>
                <button
                  className="btn btn-secondary btn-sm btn-icon"
                  type="button"
                  disabled={i === itens.length - 1}
                  aria-label={`Mover item ${i + 1} para baixo`}
                  onClick={() => {
                    const proximo = [...itens];
                    [proximo[i + 1], proximo[i]] = [proximo[i], proximo[i + 1]];
                    onChange(proximo);
                  }}
                >
                  ↓
                </button>
                <button
                  className="btn btn-danger btn-sm btn-icon"
                  type="button"
                  aria-label={`Remover item ${i + 1}`}
                  onClick={() => onChange(itens.filter((_, j) => j !== i))}
                >
                  <IconX />
                </button>
              </span>
            </div>
          ))
        ) : (
          <p className="small muted">
            Nenhum item. O Open Design compõe sem restrição neste eixo.
          </p>
        )}
      </div>
      <p className="field-help">{ajuda}</p>
    </div>
  );
}

export function BriefEditorClient({
  brief,
  handle,
}: {
  brief: BriefView;
  /** O @ da empresa, do servidor — a prévia imita o perfil dela. */
  handle: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(() => draftDe(brief));
  const [novaTag, setNovaTag] = useState("");
  const [diffAberto, setDiffAberto] = useState(false);
  const [descartando, setDescartando] = useState(false);
  const [gravando, setGravando] = useState(false);

  // Brief já aprovado: editar aqui altera algo que passou pela revisão e está a
  // um passo da publicação.
  const sensivel = brief.state === "pendente-publicacao";

  const sujo = useMemo(() => {
    const original = draftDe(brief);
    return JSON.stringify(original) !== JSON.stringify(draft);
  }, [brief, draft]);

  const erros = useMemo(() => {
    const out: [Campo, string][] = [];
    if (!draft.headline.trim())
      out.push(["headline", "A headline não pode ficar vazia."]);
    if (draft.headline.length > LIMITES.headline)
      out.push([
        "headline",
        `Máximo de ${LIMITES.headline} caracteres (zod da API).`,
      ]);
    if (draft.hook.length > LIMITES.hook)
      out.push(["hook", `Máximo de ${LIMITES.hook} caracteres.`]);
    if (!draft.caption.trim())
      out.push(["caption", "A caption não pode ficar vazia."]);
    if (draft.caption.length > LIMITES.caption)
      out.push(["caption", `Máximo de ${LIMITES.caption} caracteres.`]);
    if (draft.hashtags.length > LIMITES.hashtags)
      out.push(["hashtags", `Máximo de ${LIMITES.hashtags} hashtags.`]);
    const invalidas = draft.hashtags.filter((h) => !/^#?[\wÀ-ÿ]+$/.test(h));
    if (invalidas.length > 0)
      out.push(["hashtags", `Formato inválido: ${invalidas.join(", ")}`]);
    return out;
  }, [draft]);

  const errosDe = (campo: Campo) =>
    erros.filter(([c]) => c === campo).map(([, m]) => m);

  function editarLista(campo: "mustHave" | "avoidVisual", proximo: string[]) {
    setDraft((d) => ({ ...d, [campo]: proximo }));
  }

  function adicionarTags(entrada: string) {
    const novas = entrada
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((raw) => (raw.startsWith("#") ? raw.slice(1) : raw).toLowerCase());
    setDraft((d) => ({
      ...d,
      hashtags: [...new Set([...d.hashtags, ...novas])],
    }));
    setNovaTag("");
  }

  async function salvar() {
    if (erros.length > 0) {
      toast({
        tone: "danger",
        title: "HTTP 422 · VALIDATION_FAILED",
        detail: erros.map(([c, m]) => `${c}: ${m}`).join(" · "),
      });
      return;
    }
    setGravando(true);
    const resposta = await fetch(
      `/api/brief-editor/${brief.state}/${brief.slug}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          headline: draft.headline,
          hook: draft.hook,
          captionDraft: draft.caption,
          hashtags: draft.hashtags,
          cta: draft.cta,
          // O PATCH reescreve visual_brief inteiro: o que não é editado aqui vai
          // junto sem alteração, senão a gravação apagaria o resto do bloco.
          visualBrief: {
            baseTemplate: brief.visualBrief.baseTemplate ?? undefined,
            compositionNotes: brief.visualBrief.compositionNotes ?? undefined,
            mustHave: draft.mustHave.filter((item) => item.trim()),
            avoidVisual: draft.avoidVisual.filter((item) => item.trim()),
            aspectRatio: draft.aspectRatio,
          },
        }),
      },
    ).catch(() => null);
    setGravando(false);

    if (!resposta?.ok) {
      const corpo = await resposta?.json().catch(() => null);
      toast({
        tone: "danger",
        title: `HTTP ${resposta?.status ?? "—"} · PATCH recusado`,
        detail:
          corpo?.error ??
          "A API não aceitou a gravação; nada foi escrito no arquivo.",
      });
      return;
    }

    toast({
      tone: "ok",
      title: `Gravado em ${brief.slug}.md`,
      detail: sensivel
        ? "Brief já aprovado: a alteração vale para o pacote que ainda vai ao Open Design."
        : "Frontmatter reescrito campo a campo; comentários e corpo do arquivo ficam intactos.",
    });
    router.refresh();
  }

  const linhasDiff: { tipo: "del" | "add"; texto: string }[] = [];
  const cmp = (campo: string, antes: string, depois: string) => {
    if (antes === depois) return;
    linhasDiff.push({
      tipo: "del",
      texto: `- ${campo}: ${antes.slice(0, 160)}`,
    });
    linhasDiff.push({
      tipo: "add",
      texto: `+ ${campo}: ${depois.slice(0, 160)}`,
    });
  };
  cmp("headline", brief.headline, draft.headline);
  cmp("hook", brief.hook, draft.hook);
  cmp("caption_draft", brief.caption, draft.caption);
  cmp("cta", brief.cta, draft.cta);
  cmp("hashtags", brief.hashtags.join(" "), draft.hashtags.join(" "));
  cmp(
    "visual_brief.aspect_ratio",
    brief.visualBrief.aspectRatio,
    draft.aspectRatio,
  );
  cmp(
    "visual_brief.must_have",
    brief.visualBrief.mustHave.join(" | "),
    draft.mustHave.join(" | "),
  );
  cmp(
    "visual_brief.avoid_visual",
    brief.visualBrief.avoidVisual.join(" | "),
    draft.avoidVisual.join(" | "),
  );

  return (
    <>
      <div className="page-head">
        <Crumb
          items={[
            { label: "Painel", href: "/" },
            sensivel
              ? { label: "Acervo", href: "/acervo?estado=pendente-publicacao" }
              : { label: "Fila", href: "/fila" },
            { label: "Detalhes", href: `/briefs/${brief.state}/${brief.slug}` },
            { label: "Editor" },
          ]}
          tail={<span className="num">{brief.briefId}</span>}
          back={{
            href: `/briefs/${brief.state}/${brief.slug}`,
            destino: "Detalhes do brief",
          }}
        />
        <h1 className="display" style={{ marginTop: 12 }}>
          Editar copy e visual brief
        </h1>
        <p className="lead">
          Grava por PATCH em{" "}
          <span className="num">
            /api/brief-editor/{brief.state}/{brief.slug}
          </span>{" "}
          — só os campos editados mudam; o resto da pauta fica intacto.
        </p>
      </div>

      <div className="grid-main">
        <form
          className="stack"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void salvar();
          }}
        >
          <section className={`panel${sensivel ? " sensitive" : ""}`}>
            {sensivel && (
              <div className="sensitive-bar">
                <IconAlert />
                Brief já aprovado. Editar aqui altera algo que passou pela
                revisão e está a um passo da publicação.
              </div>
            )}
            <div className="panel-head">
              <h2 className="h3">Copy</h2>
              <span
                className={`pill ${sensivel ? "pill-warn" : "pill-accent"}`}
              >
                {STATE_META[brief.state].label}
              </span>
            </div>
            <div className="panel-body stack">
              <div
                className={`field ${errosDe("headline").length ? "field-invalid" : ""}`}
              >
                <div className="row-between">
                  <label htmlFor="headline">headline</label>
                  <Counter
                    value={draft.headline.length}
                    limit={LIMITES.headline}
                  />
                </div>
                <textarea
                  className="textarea"
                  id="headline"
                  style={{ minHeight: 60 }}
                  value={draft.headline}
                  onChange={(event) =>
                    setDraft((d) => ({ ...d, headline: event.target.value }))
                  }
                />
                {errosDe("headline").map((m) => (
                  <p className="field-error" key={m}>
                    {m}
                  </p>
                ))}
                <p className="field-help">
                  Aparece como título do card. Curta o suficiente para caber em
                  duas linhas na arte.
                </p>
              </div>

              <div
                className={`field ${errosDe("hook").length ? "field-invalid" : ""}`}
              >
                <div className="row-between">
                  <label htmlFor="hook">hook</label>
                  <Counter value={draft.hook.length} limit={LIMITES.hook} />
                </div>
                <textarea
                  className="textarea"
                  id="hook"
                  style={{ minHeight: 80 }}
                  value={draft.hook}
                  onChange={(event) =>
                    setDraft((d) => ({ ...d, hook: event.target.value }))
                  }
                />
                {errosDe("hook").map((m) => (
                  <p className="field-error" key={m}>
                    {m}
                  </p>
                ))}
              </div>

              <div
                className={`field ${errosDe("caption").length ? "field-invalid" : ""}`}
              >
                <div className="row-between">
                  <label htmlFor="caption">caption_draft</label>
                  <Counter
                    value={draft.caption.length}
                    limit={LIMITES.caption}
                  />
                </div>
                <textarea
                  className="textarea"
                  id="caption"
                  style={{ minHeight: 260 }}
                  value={draft.caption}
                  onChange={(event) =>
                    setDraft((d) => ({ ...d, caption: event.target.value }))
                  }
                />
                {errosDe("caption").map((m) => (
                  <p className="field-error" key={m}>
                    {m}
                  </p>
                ))}
                <p className="field-help">
                  O Instagram corta em ~{IG_CUT} caracteres — os primeiros{" "}
                  {IG_CUT} precisam se sustentar sozinhos. Confira na prévia ao
                  lado.
                </p>
              </div>

              <div className="field">
                <label htmlFor="cta">cta</label>
                <input
                  className="input"
                  id="cta"
                  value={draft.cta}
                  onChange={(event) =>
                    setDraft((d) => ({ ...d, cta: event.target.value }))
                  }
                />
              </div>

              <div
                className={`field ${errosDe("hashtags").length ? "field-invalid" : ""}`}
              >
                <div className="row-between">
                  <span className="field-label">hashtags</span>
                  <Counter
                    value={draft.hashtags.length}
                    limit={LIMITES.hashtags}
                  />
                </div>
                <div className="row-tight" style={{ marginTop: 4 }}>
                  {draft.hashtags.map((tag, i) => (
                    <span className="chip" key={`${tag}-${i}`}>
                      #{tag.replace(/^#/, "")}
                      <button
                        type="button"
                        aria-label={`Remover ${tag}`}
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            hashtags: d.hashtags.filter((_, j) => j !== i),
                          }))
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  className="input"
                  placeholder="Digite e pressione Enter · vírgula separa várias"
                  style={{ marginTop: 8 }}
                  aria-label="Adicionar hashtag"
                  value={novaTag}
                  onChange={(event) => setNovaTag(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== ",") return;
                    event.preventDefault();
                    adicionarTags(novaTag);
                  }}
                />
                {errosDe("hashtags").map((m) => (
                  <p className="field-error" key={m}>
                    {m}
                  </p>
                ))}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2 className="h3">Visual brief</h2>
              <span className="meta">
                od_skill_ref: {brief.odSkillRef ?? "—"}
              </span>
            </div>
            <div className="panel-body stack">
              <div className="field" style={{ maxWidth: 220 }}>
                <label htmlFor="ratio">aspect_ratio</label>
                <select
                  className="select"
                  id="ratio"
                  value={draft.aspectRatio}
                  onChange={(event) =>
                    setDraft((d) => ({ ...d, aspectRatio: event.target.value }))
                  }
                >
                  {/* O padrão do produto vem primeiro — ver
                      lib/view/proporcao.ts. Deixá-lo no meio da lista com 1:1
                      no topo dizia uma coisa no rótulo e outra na ordem. */}
                  <option value="3:4">3:4 — retrato (padrão)</option>
                  <option value="4:5">4:5 — retrato alto</option>
                  <option value="1:1">1:1 — feed quadrado</option>
                  {/* Um pilar pode declarar proporção fora desta lista. Sem
                      esta opção o valor efetivo não casaria com nenhuma, e o
                      campo apareceria vazio como se nada estivesse escolhido —
                      pior ainda, salvar apagaria a escolha do pilar. */}
                  {draft.aspectRatio &&
                    !["3:4", "4:5", "1:1"].includes(draft.aspectRatio) && (
                      <option value={draft.aspectRatio}>
                        {draft.aspectRatio} — do pilar
                      </option>
                    )}
                </select>
              </div>
              <ListEditor
                titulo="must_have"
                ajuda="O que a arte precisa conter. O Open Design trata como requisito, não sugestão."
                itens={draft.mustHave}
                onChange={(proximo) => editarLista("mustHave", proximo)}
              />
              <ListEditor
                titulo="avoid_visual"
                ajuda="O que a arte não pode conter — marca de terceiro, clichê visual, imagem sensível."
                itens={draft.avoidVisual}
                onChange={(proximo) => editarLista("avoidVisual", proximo)}
              />
            </div>
          </section>

          <div className="savebar">
            <p className="small" aria-live="polite">
              {erros.length > 0 ? (
                <span style={{ color: "var(--danger)" }} className="strong">
                  {erros.length} problema(s) impedem o salvamento
                </span>
              ) : sujo ? (
                <span style={{ color: "var(--warn)" }} className="strong">
                  Alterações não salvas
                </span>
              ) : (
                <span className="muted">
                  Nada alterado desde a última leitura
                </span>
              )}
            </p>
            <div className="row-tight">
              <button
                className="btn btn-ghost"
                type="button"
                disabled={!sujo}
                onClick={() => setDescartando(true)}
              >
                Descartar
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                disabled={!sujo}
                onClick={() => setDiffAberto(true)}
              >
                Ver o que muda
              </button>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={!sujo || erros.length > 0 || gravando}
              >
                {gravando ? "Gravando…" : "Salvar"}
              </button>
            </div>
          </div>
        </form>

        <div className="stack">
          <div className="panel">
            <div className="panel-head">
              <h2 className="h3">Prévia da legenda no feed</h2>
              <span className="meta">{draft.aspectRatio}</span>
            </div>
            <div
              className="panel-body"
              style={{ display: "grid", justifyItems: "center" }}
            >
              <IgPreview
                handle={handle}
                caption={draft.caption}
                hashtags={draft.hashtags}
                aspectRatio={draft.aspectRatio}
              />
            </div>
          </div>
          <div className="panel">
            <div className="panel-head">
              <h2 className="h3">Limites da API</h2>
            </div>
            <div className="panel-body">
              <dl className="json-view">
                {Object.entries(LIMITES).map(([chave, limite]) => (
                  <div className="json-row" key={chave}>
                    <span className="json-key">{chave}</span>
                    <span className="json-val">≤ {limite}</span>
                  </div>
                ))}
              </dl>
              <p className="field-help" style={{ marginTop: 12 }}>
                Os mesmos limites do zod em{" "}
                <span className="num">/api/brief-editor</span>. Validar aqui
                evita um 422 depois de você já ter escrito tudo.
              </p>
            </div>
          </div>
          <p>
            <Link
              className="btn btn-secondary btn-block"
              href={`/briefs/${brief.state}/${brief.slug}`}
            >
              Voltar ao detalhe
            </Link>
          </p>
        </div>
      </div>

      <Modal
        open={diffAberto}
        onClose={() => setDiffAberto(false)}
        wide
        eyebrow={brief.briefId}
        title="O que vai ser gravado"
      >
        <p className="small">
          Só as chaves abaixo são tocadas. Comentários, ordem das demais chaves
          e o corpo markdown do arquivo ficam intactos.
        </p>
        <pre className="code" style={{ marginTop: 14, whiteSpace: "pre-wrap" }}>
          {linhasDiff.length > 0 ? (
            linhasDiff.map((linha, i) => (
              <span
                className={linha.tipo === "add" ? "c-add" : "c-del"}
                key={i}
              >
                {linha.texto}
              </span>
            ))
          ) : (
            <span className="c-com">sem alterações</span>
          )}
        </pre>
      </Modal>

      <Modal
        open={descartando}
        onClose={() => setDescartando(false)}
        title="Descartar alterações?"
        footer={
          <>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setDescartando(false)}
            >
              Continuar editando
            </button>
            <button
              className="btn btn-danger"
              type="button"
              onClick={() => {
                setDraft(draftDe(brief));
                setDescartando(false);
              }}
            >
              Descartar
            </button>
          </>
        }
      >
        <p className="small">
          O rascunho existe só nesta aba. Descartar volta ao conteúdo do arquivo
          em disco.
        </p>
      </Modal>
    </>
  );
}
