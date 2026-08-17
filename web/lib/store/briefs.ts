import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { BRIEF_STATES, type BriefState, type RadarPaths } from "../manifest";
import { readFileWithFrontmatter } from "./frontmatter";

export interface HeroCandidate {
  index: number;
  fileName: string | null;
  /** Media is a gitignored cache, so a declared candidate may no longer be on disk. */
  exists: boolean;
  imageUrl?: string;
  alt?: string;
  licenseHint?: string;
  licensable?: boolean;
  cloudUrl?: string | null;
}

export interface Brief {
  slug: string;
  briefId: string;
  state: BriefState;
  filePath: string;
  headline?: string;
  hook?: string;
  pillar?: string;
  icp?: string;
  scope?: string;
  scanId?: string;
  createdAt?: string;
  updatedAt?: string;
  matchScore?: number;
  matchScoreBreakdown?: Record<string, number>;
  borderline: boolean;
  borderlineReason?: string;
  whyMatch?: string;
  sourceUrls: string[];
  /** `undefined` means the key is absent, which blocks approve.
   *  `null` means "no hero — Smart Design generates the art" (spec 001 §11.C). */
  heroChoice: number | null | undefined;
  heroChoiceDeclared: boolean;
  candidates: HeroCandidate[];
  warnings: string[];
  /** Everything the editor may want to read before deciding. */
  captionDraft?: string;
  hashtags: string[];
  cta?: string;
  suggestedSlot?: string;
  format?: string;
  odSkillRef?: string;
  odSkillAlternatives: string[];
  sourceExcerpts: string[];
  reviewNotes?: string;
  visualBrief?: VisualBrief;
  /** Per-component evidence behind the score — the reasoning the numbers alone hide. */
  relevanceHints: RelevanceHint[];
  /** Briefs from the content bank carry no scan_id and were never scored. */
  origin?: string;
  /** Lifecycle stamps written by the skills as the file moves between dirs. */
  approvedAt?: string;
  handoffAt?: string;
  publishedAt?: string;
  igPostUrl?: string;
  rejectedAt?: string;
  rejectReason?: string;
}

export interface RelevanceHint {
  component: string;
  evidence: string;
}

export interface VisualBrief {
  baseTemplate?: string;
  compositionNotes?: string;
  mustHave: string[];
  avoidVisual: string[];
  aspectRatio?: string;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function buildCandidates(
  raw: unknown,
  mediaDir: string,
  warnings: string[],
): Promise<HeroCandidate[]> {
  if (!Array.isArray(raw)) return [];

  return Promise.all(
    raw.map(async (entry, position) => {
      const item = (entry ?? {}) as Record<string, unknown>;
      const index = num(item.index) ?? position;
      const declared = str(item.local_path);

      // Resolve by basename inside the state's media dir rather than trusting
      // local_path, which is generated text and could point anywhere.
      const fileName = declared ? path.basename(declared) : null;
      const exists = fileName ? await fileExists(path.join(mediaDir, fileName)) : false;
      if (fileName && !exists) {
        warnings.push(`candidata ${index} declarada mas ausente do cache: ${fileName}`);
      }

      return {
        index,
        fileName,
        exists,
        imageUrl: str(item.image_url),
        alt: str(item.alt),
        licenseHint: str(item.license_hint),
        licensable: typeof item.licensable === "boolean" ? item.licensable : undefined,
        cloudUrl: str(item.cloud_url) ?? null,
      };
    }),
  );
}

/** Exported for the storage layer (lib/store/index.ts); pages go through it. */
export async function readBrief(
  filePath: string,
  state: BriefState,
  mediaDir: string,
): Promise<Brief> {
  const { data } = await readFileWithFrontmatter(filePath);
  const warnings: string[] = [];

  const slug = str(data.slug) ?? path.basename(filePath, ".md");
  if (!str(data.slug)) warnings.push("frontmatter sem `slug`; derivado do nome do arquivo");

  const heroChoiceDeclared = Object.hasOwn(data, "hero_choice");
  const rawChoice = data.hero_choice;
  const heroChoice = !heroChoiceDeclared
    ? undefined
    : rawChoice === null
      ? null
      : num(rawChoice);
  if (heroChoiceDeclared && rawChoice !== null && heroChoice === undefined) {
    warnings.push(`hero_choice com valor inesperado: ${JSON.stringify(rawChoice)}`);
  }

  const breakdown = data.match_score_breakdown;
  const matchScoreBreakdown =
    breakdown && typeof breakdown === "object" && !Array.isArray(breakdown)
      ? Object.fromEntries(
          Object.entries(breakdown as Record<string, unknown>).flatMap(([key, value]) =>
            typeof value === "number" ? [[key, value] as const] : [],
          ),
        )
      : undefined;

  return {
    slug,
    briefId: str(data.brief_id) ?? slug,
    state,
    filePath,
    headline: str(data.headline),
    hook: str(data.hook),
    pillar: str(data.pillar),
    icp: str(data.icp),
    scope: str(data.scope),
    scanId: str(data.scan_id),
    createdAt: str(data.created_at),
    updatedAt: str(data.updated_at),
    matchScore: num(data.match_score),
    matchScoreBreakdown,
    borderline: data.borderline === true,
    borderlineReason: str(data.borderline_reason),
    whyMatch: str(data.why_match),
    sourceUrls: strArray(data.source_urls),
    heroChoice,
    heroChoiceDeclared,
    candidates: await buildCandidates(data.hero_image_candidates, mediaDir, warnings),
    warnings,
    captionDraft: str(data.caption_draft),
    hashtags: strArray(data.hashtags),
    cta: str(data.cta),
    suggestedSlot: str(data.suggested_slot),
    format: str(data.format),
    odSkillRef: str(data.od_skill_ref),
    odSkillAlternatives: strArray(data.od_skill_alternatives),
    sourceExcerpts: strArray(data.source_excerpts),
    reviewNotes: str(data.review_notes),
    visualBrief: buildVisualBrief(data.visual_brief),
    relevanceHints: buildRelevanceHints(data.source_relevance_hints),
    origin: str(data.origin),
    approvedAt: str(data.approved_at),
    handoffAt: str(data.handoff_at),
    publishedAt: str(data.published_at),
    igPostUrl: str(data.ig_post_url),
    rejectedAt: str(data.rejected_at),
    rejectReason: str(data.reject_reason) ?? str(data.rejection_reason),
  };
}

function buildRelevanceHints(raw: unknown): RelevanceHint[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>;
    const component = str(item.component);
    const evidence = str(item.evidence);
    return component && evidence ? [{ component, evidence }] : [];
  });
}

function buildVisualBrief(raw: unknown): VisualBrief | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const item = raw as Record<string, unknown>;
  return {
    baseTemplate: str(item.base_template),
    compositionNotes: str(item.composition_notes),
    mustHave: strArray(item.must_have),
    avoidVisual: strArray(item.avoid_visual),
    aspectRatio: str(item.aspect_ratio),
  };
}

export interface StateListing {
  state: BriefState;
  briefs: Brief[];
  /** Files that could not be parsed at all — reported instead of hidden. */
  failures: { filePath: string; message: string }[];
}

export async function listState(state: BriefState, paths: RadarPaths): Promise<StateListing> {
  let entries: string[];
  try {
    entries = await readdir(paths.briefsDir[state]);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { state, briefs: [], failures: [] };
    }
    throw error;
  }

  const briefs: Brief[] = [];
  const failures: StateListing["failures"] = [];

  for (const entry of entries.filter((name) => name.endsWith(".md")).sort()) {
    const filePath = path.join(paths.briefsDir[state], entry);
    try {
      briefs.push(await readBrief(filePath, state, paths.mediaDir[state]));
    } catch (error) {
      failures.push({ filePath, message: (error as Error).message });
    }
  }

  return { state, briefs, failures };
}

export async function listAllStates(paths: RadarPaths): Promise<StateListing[]> {
  return Promise.all(BRIEF_STATES.map((state) => listState(state, paths)));
}
