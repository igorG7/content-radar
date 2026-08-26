export interface QueueCandidate {
  index: number;
  fileName: string | null;
  exists: boolean;
  alt?: string;
  licenseHint?: string;
  licensable?: boolean;
}

export interface QueueVisualBrief {
  baseTemplate?: string;
  compositionNotes?: string;
  mustHave: string[];
  avoidVisual: string[];
  aspectRatio?: string;
}

export interface QueueBrief {
  state?: string;
  slug: string;
  briefId: string;
  headline?: string;
  hook?: string;
  pillar?: string;
  icp?: string;
  scope?: string;
  scanId?: string;
  createdAt?: string;
  matchScore?: number;
  matchScoreBreakdown?: Record<string, number>;
  borderline: boolean;
  borderlineReason?: string;
  whyMatch?: string;
  sourceUrls: string[];
  sourceExcerpts: string[];
  storedHeroChoice: number | null | undefined;
  candidates: QueueCandidate[];
  captionDraft?: string;
  hashtags: string[];
  cta?: string;
  suggestedSlot?: string;
  format?: string;
  odSkillRef?: string;
  odSkillAlternatives: string[];
  reviewNotes?: string;
  visualBrief?: QueueVisualBrief;
  relevanceHints: { component: string; evidence: string }[];
  origin?: string;
}
