import type { QueueBrief } from "./queue-types";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[color:var(--line)] pt-6">
      <h3 className="mb-4 text-sm font-semibold uppercase muted">{title}</h3>
      {children}
    </section>
  );
}

function InfoBlock({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "warm" }) {
  return (
    <div
      className={`rounded-lg p-4 ${
        tone === "warm" ? "warm-block" : "bg-[color:var(--surface-soft-alpha)]"
      }`}
    >
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-sm font-semibold uppercase muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Chips({ items, prefix = "" }: { items: string[]; prefix?: string }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item} className="pill px-2.5 py-1.5 font-mono text-sm">
          {prefix}
          {item}
        </li>
      ))}
    </ul>
  );
}

export function BriefDetailContent({ brief }: { brief: QueueBrief }) {
  return (
    <div className="space-y-7 text-base">
      {brief.borderline && brief.borderlineReason && (
        <p className="alert-warning p-4 leading-7">
          <strong className="font-semibold">Match marginal:</strong> {brief.borderlineReason}
        </p>
      )}

      {brief.hook && (
        <section className="surface p-5">
          <p className="text-lg italic leading-8 text-[var(--text-accent)]">{brief.hook}</p>
        </section>
      )}

      {brief.captionDraft && (
        <Section title="Rascunho da legenda">
          <InfoBlock>
            <p className="whitespace-pre-wrap leading-8">{brief.captionDraft}</p>
          </InfoBlock>
        </Section>
      )}

      {(brief.hashtags.length > 0 || brief.cta) && (
        <Section title="Distribuição">
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,0.6fr)]">
            {brief.hashtags.length > 0 && (
              <InfoBlock>
                <div className="space-y-3">
                  <p className="text-sm font-semibold uppercase muted">hashtags</p>
                  <Chips items={brief.hashtags} prefix="#" />
                </div>
              </InfoBlock>
            )}
            {brief.cta && (
              <InfoBlock>
                <div className="space-y-2">
                  <p className="text-sm font-semibold uppercase muted">CTA</p>
                  <p className="leading-7">{brief.cta}</p>
                </div>
              </InfoBlock>
            )}
          </div>
        </Section>
      )}

      {brief.candidates.length > 0 && (
        <Section title="Fotos candidatas">
          <ul className="grid gap-5 sm:grid-cols-2">
            {brief.candidates.map((candidate) => (
              <li key={candidate.index} className="surface overflow-hidden">
                {candidate.exists && candidate.fileName ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/media/${brief.state ?? "pendente-aprovacao"}/${encodeURIComponent(candidate.fileName)}`}
                    alt={candidate.alt ?? `candidata ${candidate.index}`}
                    className="h-52 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-52 items-center justify-center bg-[color:var(--surface-soft-strong)] text-sm muted">
                    fora do cache
                  </div>
                )}
                <div className="space-y-3 p-4 text-sm leading-6">
                  <div className="inline-flex rounded bg-[color:var(--inline-soft)] px-2 py-1 font-mono text-sm text-[var(--text-accent)]">
                    índice {candidate.index}
                  </div>
                  {candidate.alt && <p>{candidate.alt}</p>}
                  {candidate.licensable === false && (
                    <p className="font-semibold text-[#7b4b12]">não licenciável — uso referencial</p>
                  )}
                  {candidate.licenseHint && <p className="muted">{candidate.licenseHint}</p>}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {brief.visualBrief && (
        <Section title="Briefing visual">
          <dl className="grid gap-5 sm:grid-cols-2">
            {brief.visualBrief.baseTemplate && (
              <InfoBlock>
                <Field label="template base">
                  <span className="font-mono text-base">{brief.visualBrief.baseTemplate}</span>
                </Field>
              </InfoBlock>
            )}
            {brief.visualBrief.aspectRatio && (
              <InfoBlock>
                <Field label="proporção">
                  <span className="font-mono text-base">{brief.visualBrief.aspectRatio}</span>
                </Field>
              </InfoBlock>
            )}
            {brief.visualBrief.compositionNotes && (
              <div className="sm:col-span-2">
                <InfoBlock>
                  <Field label="composição">
                    <p className="whitespace-pre-wrap leading-8">{brief.visualBrief.compositionNotes}</p>
                  </Field>
                </InfoBlock>
              </div>
            )}
            {brief.visualBrief.mustHave.length > 0 && (
              <InfoBlock>
                <Field label="obrigatório">
                  <ul className="space-y-2 pl-5 list-disc leading-7">
                    {brief.visualBrief.mustHave.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </Field>
              </InfoBlock>
            )}
            {brief.visualBrief.avoidVisual.length > 0 && (
              <InfoBlock tone="warm">
                <Field label="evitar">
                  <ul className="space-y-2 pl-5 list-disc leading-7">
                    {brief.visualBrief.avoidVisual.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </Field>
              </InfoBlock>
            )}
          </dl>
        </Section>
      )}

      {(brief.odSkillRef || brief.odSkillAlternatives.length > 0) && (
        <Section title="Smart Design">
          <InfoBlock>
            <dl className="space-y-4">
              <Field label="skill recomendada">
                <span className="font-mono">{brief.odSkillRef ?? "—"}</span>
              </Field>
              {brief.odSkillAlternatives.length > 0 && (
                <Field label="alternativas">
                  <Chips items={brief.odSkillAlternatives} />
                </Field>
              )}
            </dl>
          </InfoBlock>
        </Section>
      )}

      {brief.whyMatch && (
        <Section title="Por que casou">
          <div className="space-y-5">
            <InfoBlock>
              <p className="whitespace-pre-wrap leading-8 muted">{brief.whyMatch}</p>
            </InfoBlock>
            {brief.matchScoreBreakdown && (
              <dl className="overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-soft-alpha)] text-sm">
                  {Object.entries(brief.matchScoreBreakdown).map(([component, value]) => {
                    const evidence = brief.relevanceHints.find(
                      (hint) => hint.component === component,
                    )?.evidence;
                    return (
                      <div key={component} className="border-t border-[color:var(--line)] px-4 py-3 first:border-t-0">
                        <dt className="flex items-baseline justify-between gap-4">
                          <span className="font-mono font-semibold text-[var(--text-accent)]">{component}</span>
                          <span className="font-semibold tabular-nums text-[var(--text-accent)]">{value}</span>
                        </dt>
                        {evidence && <dd className="mt-1 leading-6 muted">{evidence}</dd>}
                      </div>
                    );
                  })}
                  <div className="flex justify-between gap-4 border-t border-[color:var(--line-strong)] bg-[color:var(--surface-alpha)] px-4 py-3 font-semibold">
                  <dt>total</dt>
                  <dd className="tabular-nums text-[var(--text-accent)]">{brief.matchScore ?? "—"}</dd>
                </div>
              </dl>
            )}
          </div>
        </Section>
      )}

      {(brief.sourceExcerpts.length > 0 || brief.sourceUrls.length > 0) && (
        <Section title="Fontes">
          <div className="space-y-5">
            {brief.sourceExcerpts.length > 0 && (
              <div className="space-y-3">
                {brief.sourceExcerpts.map((excerpt) => (
                  <blockquote key={excerpt} className="rounded-lg border-l-4 border-[color:var(--line-strong)] bg-[color:var(--surface-soft-alpha)] p-4 leading-7 muted">
                    {excerpt}
                  </blockquote>
                ))}
              </div>
            )}
            {brief.sourceUrls.length > 0 && (
              <InfoBlock>
                <ul className="space-y-3">
                  {brief.sourceUrls.map((url) => (
                    <li key={url}>
                      <a href={url} target="_blank" rel="noreferrer" className="break-all text-link underline">
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              </InfoBlock>
            )}
          </div>
        </Section>
      )}

      {brief.reviewNotes && (
        <Section title="Notas de revisão">
          <InfoBlock tone="warm">
            <p className="whitespace-pre-wrap leading-8">{brief.reviewNotes}</p>
          </InfoBlock>
        </Section>
      )}

      <Section title="Procedência">
        <dl className="grid gap-4 text-sm muted sm:grid-cols-2 lg:grid-cols-4">
          <InfoBlock>
            <Field label={brief.scanId ? "scan" : "origem"}>
              <span className="font-mono">{brief.scanId ?? brief.origin ?? "—"}</span>
            </Field>
          </InfoBlock>
          <InfoBlock>
            <Field label="criado em">
              <span className="font-mono">{brief.createdAt?.slice(0, 19) ?? "—"}</span>
            </Field>
          </InfoBlock>
          <InfoBlock>
            <Field label="formato">
              <span className="font-mono">{brief.format ?? "—"}</span>
            </Field>
          </InfoBlock>
          <InfoBlock>
            <Field label="slot sugerido">
              <span className="font-mono">{brief.suggestedSlot ?? "—"}</span>
            </Field>
          </InfoBlock>
        </dl>
      </Section>
    </div>
  );
}
