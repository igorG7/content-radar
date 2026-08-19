import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";

// The Next app lives at <radar>/web, so the radar root is one level up.
// RADAR_ROOT overrides it for deploys where cwd differs (pm2, tests).
export const RADAR_ROOT = process.env.RADAR_ROOT
  ? path.resolve(process.env.RADAR_ROOT)
  : path.resolve(process.cwd(), "..");

export const MANIFEST_PATH = path.join(RADAR_ROOT, "manifest.yaml");

export const BRIEF_STATES = [
  "pendente-aprovacao",
  "pendente-publicacao",
  "publicado",
  "rejeitado",
] as const;

export type BriefState = (typeof BRIEF_STATES)[number];

const StateDirs = z.object({
  pendente_aprovacao: z.string(),
  pendente_publicacao: z.string(),
  publicado: z.string(),
  rejeitado: z.string(),
});

const ManifestSchema = z.object({
  storage: z.object({
    briefs_root: z.string(),
    briefs_dirs: StateDirs,
    media_root: z.string(),
    media_dirs: StateDirs,
    ledger: z.string(),
  }),
  search_scopes: z.record(
    z.string(),
    z.object({
      label: z.string(),
      sources: z.array(z.string()),
      pillars_alvo: z.array(z.string()).optional(),
    }),
  ),
  funnel: z.object({ candidates_per_week_target: z.number() }),
  anti_repetition: z.object({
    match_score_min: z.number(),
    borderline_min: z.number(),
    geografia_reframe_floor: z.number().optional(),
    match_score_weights: z.record(z.string(), z.number()),
    // Janelas que o matcher considera "recente" — o acervo filtra pelas mesmas.
    windows: z
      .object({
        publicado_days: z.number().optional(),
        rejeitado_days: z.number().optional(),
        pillar_icp_redundant_days: z.number().optional(),
      })
      .optional(),
  }),
  cadence: z.object({
    pillars_by_day_base: z.record(z.string(), z.array(z.string())),
  }),
});

export type Manifest = z.infer<typeof ManifestSchema>;

/** Read fresh on every call so config edits take effect without a restart. */
export async function loadManifest(): Promise<Manifest> {
  const raw = await readFile(MANIFEST_PATH, "utf8");
  return ManifestSchema.parse(parse(raw));
}

type StateDirKey = keyof z.infer<typeof StateDirs>;

function stateKey(state: BriefState): StateDirKey {
  return state.replace(/-/g, "_") as StateDirKey;
}

export interface RadarPaths {
  briefsDir: Record<BriefState, string>;
  mediaDir: Record<BriefState, string>;
  mediaRoot: string;
  ledger: string;
}

export function resolvePaths(manifest: Manifest): RadarPaths {
  const { storage } = manifest;
  const briefsRoot = path.resolve(RADAR_ROOT, storage.briefs_root);
  const mediaRoot = path.resolve(RADAR_ROOT, storage.media_root);

  const briefsDir = {} as Record<BriefState, string>;
  const mediaDir = {} as Record<BriefState, string>;
  for (const state of BRIEF_STATES) {
    briefsDir[state] = path.join(
      briefsRoot,
      storage.briefs_dirs[stateKey(state)],
    );
    mediaDir[state] = path.join(mediaRoot, storage.media_dirs[stateKey(state)]);
  }

  return {
    briefsDir,
    mediaDir,
    mediaRoot,
    ledger: path.resolve(RADAR_ROOT, storage.ledger),
  };
}

/** Pillar 4 lives in stories and is out of the radar's scope (CLAUDE.md, spec 001 §3). */
export const EXCLUDED_PILLAR = "4-bastidor";

export function selectablePillars(manifest: Manifest): string[] {
  const seen = new Set<string>();
  for (const pillars of Object.values(manifest.cadence.pillars_by_day_base)) {
    for (const pillar of pillars) {
      if (pillar !== EXCLUDED_PILLAR) seen.add(pillar);
    }
  }
  return [...seen].sort();
}
