import type { Brief } from "@/lib/store/briefs";
import type { QueueBrief } from "./queue-types";

export function toQueueBrief(brief: Brief): QueueBrief {
  return {
    state: brief.state,
    slug: brief.slug,
    briefId: brief.briefId,
    headline: brief.headline,
    hook: brief.hook,
    pillar: brief.pillar,
    icp: brief.icp,
    matchScore: brief.matchScore,
    borderline: brief.borderline,
    borderlineReason: brief.borderlineReason,
    whyMatch: brief.whyMatch,
    sourceUrls: brief.sourceUrls,
    sourceExcerpts: brief.sourceExcerpts,
    scope: brief.scope,
    scanId: brief.scanId,
    createdAt: brief.createdAt,
    matchScoreBreakdown: brief.matchScoreBreakdown,
    captionDraft: brief.captionDraft,
    hashtags: brief.hashtags,
    cta: brief.cta,
    suggestedSlot: brief.suggestedSlot,
    format: brief.format,
    odSkillRef: brief.odSkillRef,
    odSkillAlternatives: brief.odSkillAlternatives,
    reviewNotes: brief.reviewNotes,
    visualBrief: brief.visualBrief,
    relevanceHints: brief.relevanceHints,
    origin: brief.origin,
    storedHeroChoice: brief.heroChoiceDeclared ? brief.heroChoice : undefined,
    candidates: brief.candidates.map((candidate) => ({
      index: candidate.index,
      fileName: candidate.fileName,
      exists: candidate.exists,
      alt: candidate.alt,
      licenseHint: candidate.licenseHint,
      licensable: candidate.licensable,
    })),
  };
}
