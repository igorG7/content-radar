import { readdir, rename, unlink } from "node:fs/promises";
import path from "node:path";
import type { BriefState, RadarPaths } from "../manifest";
import {
  readFileWithFrontmatter,
  appendToTextBlock,
  patchScalars,
} from "../store/frontmatter";
import { readFile, writeFile } from "node:fs/promises";
import { APP_ACTOR, appendLedger, type LedgerEvent } from "../store/ledger";

export type Direction = "approve" | "reject";

const TARGET: Record<Direction, BriefState> = {
  approve: "pendente-publicacao",
  reject: "rejeitado",
};

const SOURCE: BriefState = "pendente-aprovacao";

export class TransitionError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "TransitionError";
  }
}

export interface TransitionInput {
  slug: string;
  direction: Direction;
  reason?: string;
  dryRun?: boolean;
  actor?: string;
}

export interface TransitionPlan {
  slug: string;
  briefId: string;
  direction: Direction;
  from: BriefState;
  to: BriefState;
  heroChoice: number | null;
  mediaKept: string | null;
  mediaDeleted: string[];
  warnings: string[];
}

export interface TransitionResult extends TransitionPlan {
  applied: boolean;
  ledgerEvent: LedgerEvent | null;
}

function isoWithOffset(now = new Date()): string {
  const pad = (value: number) => String(Math.abs(value)).padStart(2, "0");
  const offset = -now.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}` +
    `${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`
  );
}

async function listSlugMedia(
  mediaDir: string,
  slug: string,
): Promise<string[]> {
  try {
    const entries = await readdir(mediaDir);
    return entries.filter((name) => name.startsWith(`${slug}__`)).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function locateBrief(
  slug: string,
  paths: RadarPaths,
): Promise<BriefState | null> {
  for (const state of Object.keys(paths.briefsDir) as BriefState[]) {
    try {
      const entries = await readdir(paths.briefsDir[state]);
      if (entries.includes(`${slug}.md`)) return state;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return null;
}

/**
 * The transition rules, which used to live in the radar-mv skill:
 * hero_choice must be declared (null is a valid, explicit "no photo"),
 * approve only leaves pendente-aprovacao/, and rejeitado/ keeps no media.
 */
export async function planTransition(
  input: TransitionInput,
  paths: RadarPaths,
): Promise<TransitionPlan> {
  const { slug, direction } = input;
  const warnings: string[] = [];

  const location = await locateBrief(slug, paths);
  if (location === null) {
    throw new TransitionError(
      "not_found",
      `brief \`${slug}\` não existe em nenhum diretório`,
    );
  }
  if (location !== SOURCE) {
    throw new TransitionError(
      "wrong_state",
      `brief \`${slug}\` está em ${location}/; a transição só parte de ${SOURCE}/`,
    );
  }

  const filePath = path.join(paths.briefsDir[SOURCE], `${slug}.md`);
  const { data } = await readFileWithFrontmatter(filePath);

  if (!Object.hasOwn(data, "hero_choice")) {
    throw new TransitionError(
      "hero_choice_missing",
      "frontmatter sem `hero_choice`; a escolha precisa ser explícita antes de aprovar",
    );
  }

  const rawChoice = data.hero_choice;
  const heroChoice =
    rawChoice === null ? null : typeof rawChoice === "number" ? rawChoice : NaN;
  if (Number.isNaN(heroChoice)) {
    throw new TransitionError(
      "hero_choice_invalid",
      `hero_choice inválido: ${JSON.stringify(rawChoice)}`,
    );
  }

  const onDisk = await listSlugMedia(paths.mediaDir[SOURCE], slug);

  if (direction === "reject") {
    return {
      slug,
      briefId: typeof data.brief_id === "string" ? data.brief_id : slug,
      direction,
      from: SOURCE,
      to: TARGET.reject,
      heroChoice,
      mediaKept: null,
      mediaDeleted: onDisk,
      warnings,
    };
  }

  let mediaKept: string | null = null;
  if (heroChoice !== null) {
    const candidates = Array.isArray(data.hero_image_candidates)
      ? (data.hero_image_candidates as { index?: unknown }[])
      : [];
    const declared = candidates.some(
      (candidate) => candidate?.index === heroChoice,
    );
    if (!declared) {
      throw new TransitionError(
        "hero_choice_out_of_range",
        `hero_choice ${heroChoice} não corresponde a nenhuma candidata declarada`,
      );
    }
    mediaKept =
      onDisk.find((name) => name.startsWith(`${slug}__${heroChoice}.`)) ?? null;
    if (mediaKept === null) {
      warnings.push(
        `a foto ${heroChoice} não está no cache local; o brief avança sem mídia para o handoff`,
      );
    }
  } else {
    warnings.push("aprovado sem foto — o Smart Design gera a arte");
  }

  return {
    slug,
    briefId: typeof data.brief_id === "string" ? data.brief_id : slug,
    direction,
    from: SOURCE,
    to: TARGET.approve,
    heroChoice,
    mediaKept,
    mediaDeleted: onDisk.filter((name) => name !== mediaKept),
    warnings,
  };
}

export async function runTransition(
  input: TransitionInput,
  paths: RadarPaths,
): Promise<TransitionResult> {
  const plan = await planTransition(input, paths);
  if (input.dryRun) {
    return { ...plan, applied: false, ledgerEvent: null };
  }

  const now = isoWithOffset();
  const fromPath = path.join(paths.briefsDir[plan.from], `${plan.slug}.md`);
  const toPath = path.join(paths.briefsDir[plan.to], `${plan.slug}.md`);

  // Same order as the skill: brief first, then media, then ledger — so a
  // failure leaves the brief moved and the media reconcilable, never the reverse.
  await rename(fromPath, toPath);

  let raw = await readFile(toPath, "utf8");
  raw = patchScalars(raw, { updated_at: now });
  if (plan.direction === "reject") {
    const reason = input.reason?.trim() || "(sem motivo)";
    raw = appendToTextBlock(raw, "review_notes", `[REJECT @ ${now}] ${reason}`);
  }
  await writeFile(toPath, raw, "utf8");

  if (plan.mediaKept) {
    await rename(
      path.join(paths.mediaDir[plan.from], plan.mediaKept),
      path.join(paths.mediaDir[plan.to], plan.mediaKept),
    );
  }
  for (const fileName of plan.mediaDeleted) {
    await unlink(path.join(paths.mediaDir[plan.from], fileName));
  }

  const ledgerEvent = await appendLedger(paths.ledger, {
    brief_id: plan.briefId,
    from_dir: `briefs/${plan.from}`,
    to_dir: `briefs/${plan.to}`,
    actor: input.actor ?? APP_ACTOR,
    event: plan.direction === "approve" ? "mv-approved" : "mv-rejected",
    extra:
      plan.direction === "approve"
        ? {
            hero_choice: plan.heroChoice,
            media_kept: plan.mediaKept ?? "none",
            media_deleted: plan.mediaDeleted,
            reason: input.reason ?? null,
          }
        : {
            reason: input.reason ?? null,
            media_purged: plan.mediaDeleted,
          },
    ts: now,
  });

  return { ...plan, applied: true, ledgerEvent };
}
