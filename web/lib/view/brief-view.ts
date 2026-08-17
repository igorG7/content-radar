import type { BriefState, Manifest } from "@/lib/manifest";
import type { Brief } from "@/lib/store/briefs";
import { weekOf } from "@/lib/format";

/**
 * Ponte entre o que está no disco e o que as telas mostram. O protótipo foi
 * desenhado sobre um store de exemplo; aqui o mesmo formato é montado a partir
 * do frontmatter real, sem renomear nada no arquivo. Tudo que sai daqui é
 * serializável: os client components recebem esta forma, nunca `Brief` cru
 * (que carrega caminho absoluto do servidor).
 */

export interface MediaView {
  index: number;
  file: string | null;
  alt: string | null;
  licenseHint: string | null;
  licensable: boolean | null;
  /** Declarada no frontmatter mas ausente do cache — o cache é gitignored. */
  missing: boolean;
  /** Rota que serve o arquivo do cache local; null quando não há arquivo. */
  url: string | null;
  cloudUrl: string | null;
}

export interface ScoreComponent {
  key: string;
  label: string;
  /** Valor bruto do componente, 0–1. */
  raw: number;
  weight: number;
  /** Contribuição no score final: raw × weight. */
  value: number;
  hint: string | null;
}

export interface BriefView {
  slug: string;
  briefId: string;
  state: BriefState;
  week: string;
  pilar: string | null;
  icp: string | null;
  scope: string | null;
  headline: string;
  hook: string;
  caption: string;
  hashtags: string[];
  cta: string;
  matchScore: number | null;
  breakdown: ScoreComponent[];
  borderline: boolean;
  borderlineReason: string | null;
  whyMatch: string | null;
  media: MediaView[];
  /** `undefined` = chave ausente (bloqueia aprovar); `null` = sem foto. */
  heroChoice: number | null | undefined;
  heroChoiceDeclared: boolean;
  visualBrief: {
    aspectRatio: string;
    mustHave: string[];
    avoidVisual: string[];
    baseTemplate: string | null;
    compositionNotes: string | null;
  };
  odSkillRef: string | null;
  odSkillAlternatives: string[];
  sourceUrls: string[];
  sourceExcerpts: string[];
  scanId: string | null;
  origin: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  approvedAt: string | null;
  handoffAt: string | null;
  publishedAt: string | null;
  igPostUrl: string | null;
  rejectedAt: string | null;
  rejectReason: string | null;
  warnings: string[];
}

const LABELS: Record<string, string> = {
  pillar_fit: "Aderência ao pilar",
  foco_editorial_fit: "Foco editorial",
  geografia_fit: "Ancoragem na RMBH",
  icp_fit: "Aderência ao ICP",
  freshness: "Atualidade",
};

export function componentLabel(key: string): string {
  return LABELS[key] ?? key.replace(/_/g, " ");
}

export interface Scoring {
  weights: Record<string, number>;
  matchScoreMin: number;
  borderlineMin: number;
}

export function scoringOf(manifest: Manifest): Scoring {
  return {
    weights: manifest.anti_repetition.match_score_weights,
    matchScoreMin: manifest.anti_repetition.match_score_min,
    borderlineMin: manifest.anti_repetition.borderline_min,
  };
}

export const ASPECT_PADRAO = "1:1";

export function toBriefView(brief: Brief, scoring: Scoring): BriefView {
  const breakdown = brief.matchScoreBreakdown ?? {};
  const hints = new Map(brief.relevanceHints.map((h) => [h.component, h.evidence]));

  // A ordem é a do manifest: é ela que a legenda e a barra seguem, para o
  // mesmo componente cair sempre na mesma faixa de cor.
  const componentes: ScoreComponent[] = Object.entries(scoring.weights).map(([key, weight]) => {
    const raw = breakdown[key] ?? 0;
    return {
      key,
      label: componentLabel(key),
      raw,
      weight,
      value: raw * weight,
      hint: hints.get(key) ?? null,
    };
  });

  const media: MediaView[] = brief.candidates.map((candidate) => ({
    index: candidate.index,
    file: candidate.fileName,
    alt: candidate.alt ?? null,
    licenseHint: candidate.licenseHint ?? null,
    licensable: candidate.licensable ?? null,
    missing: !candidate.exists,
    url:
      candidate.exists && candidate.fileName
        ? `/api/media/${brief.state}/${encodeURIComponent(candidate.fileName)}`
        : null,
    cloudUrl: candidate.cloudUrl ?? null,
  }));

  return {
    slug: brief.slug,
    briefId: brief.briefId,
    state: brief.state,
    week: weekOf(brief.briefId),
    pilar: brief.pillar ?? null,
    icp: brief.icp ?? null,
    scope: brief.scope ?? null,
    headline: brief.headline ?? brief.slug,
    hook: brief.hook ?? "",
    caption: brief.captionDraft ?? "",
    hashtags: brief.hashtags,
    cta: brief.cta ?? "",
    matchScore: brief.matchScore ?? null,
    breakdown: componentes,
    borderline: brief.borderline,
    borderlineReason: brief.borderlineReason ?? null,
    whyMatch: brief.whyMatch ?? null,
    media,
    heroChoice: brief.heroChoice,
    heroChoiceDeclared: brief.heroChoiceDeclared,
    visualBrief: {
      aspectRatio: brief.visualBrief?.aspectRatio ?? ASPECT_PADRAO,
      mustHave: brief.visualBrief?.mustHave ?? [],
      avoidVisual: brief.visualBrief?.avoidVisual ?? [],
      baseTemplate: brief.visualBrief?.baseTemplate ?? null,
      compositionNotes: brief.visualBrief?.compositionNotes ?? null,
    },
    odSkillRef: brief.odSkillRef ?? null,
    odSkillAlternatives: brief.odSkillAlternatives,
    sourceUrls: brief.sourceUrls,
    sourceExcerpts: brief.sourceExcerpts,
    scanId: brief.scanId ?? null,
    origin: brief.origin ?? null,
    createdAt: brief.createdAt ?? null,
    updatedAt: brief.updatedAt ?? null,
    approvedAt: brief.approvedAt ?? null,
    handoffAt: brief.handoffAt ?? null,
    publishedAt: brief.publishedAt ?? null,
    igPostUrl: brief.igPostUrl ?? null,
    rejectedAt: brief.rejectedAt ?? null,
    rejectReason: brief.rejectReason ?? null,
    warnings: brief.warnings,
  };
}

export const STATE_META: Record<BriefState, { label: string; short: string; tone: string }> = {
  "pendente-aprovacao": { label: "Pendente de aprovação", short: "Fila", tone: "warn" },
  "pendente-publicacao": { label: "Pendente de publicação", short: "Aprovado", tone: "ok" },
  publicado: { label: "Publicado", short: "Publicado", tone: "accent" },
  rejeitado: { label: "Rejeitado", short: "Rejeitado", tone: "danger" },
};

/** A data que ordena o acervo e conta nas janelas de anti-repetição. */
export function dataRef(brief: BriefView): string {
  return (
    brief.publishedAt ??
    brief.rejectedAt ??
    brief.approvedAt ??
    brief.updatedAt ??
    brief.createdAt ??
    ""
  );
}

export const TRANSITION_ERRORS: Record<string, string> = {
  HERO_CHOICE_UNDECIDED:
    "A escolha da arte ainda não foi feita nesta sessão. Selecione uma candidata ou marque “sem foto” antes de aprovar.",
  MEDIA_MISSING:
    "A mídia escolhida não existe mais no cache. Escolha outra candidata ou marque “sem foto”.",
  ALREADY_MOVED: "Este brief já saiu da fila em outra aba ou sessão. Recarregue a página.",
  REASON_REQUIRED:
    "Rejeitar exige um motivo — ele vai para o ledger e alimenta a checagem de anti-repetição.",
  IG_URL_REQUIRED: "Marcar como publicado exige a URL do post — é ela que fecha o ciclo no ledger.",
  IG_URL_INVALID:
    "A URL precisa ser de um post ou reel do Instagram: instagram.com/p/… ou instagram.com/reel/…",
  PUBLISHED_AT_REQUIRED:
    "Informe quando o post foi ao ar — é esta data que ordena o acervo e conta nas janelas de anti-repetição.",
  PUBLISHED_AT_FUTURE:
    "A data de publicação não pode estar no futuro: o registro é de algo que já aconteceu.",
  PUBLISHED_AT_BEFORE_APPROVAL: "A publicação não pode ser anterior à aprovação do brief.",
};
