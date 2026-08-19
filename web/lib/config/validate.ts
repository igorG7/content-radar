import { parse } from "yaml";
import { z } from "zod";
import { EXCLUDED_PILLAR } from "../manifest";

const ratio = z.number().min(0).max(1);

/**
 * Invariants the manifest states in prose but nothing enforced until now:
 * weights summing to 1.0 (spec 003 §5) and borderline sitting under the
 * promote threshold, or the tier disappears.
 */
const EditableManifest = z
  .object({
    search_scopes: z.record(
      z.string(),
      z.object({
        label: z.string().min(1),
        sources: z.array(z.string().min(1)).min(1),
        pillars_alvo: z.array(z.string()).optional(),
      }),
    ),
    funnel: z.object({ candidates_per_week_target: z.number().int().min(1) }),
    anti_repetition: z.object({
      match_score_min: ratio,
      borderline_min: ratio,
      geografia_reframe_floor: ratio.optional(),
      match_score_weights: z.record(z.string(), ratio),
    }),
    cadence: z.object({
      pillars_by_day_base: z.record(z.string(), z.array(z.string())),
    }),
  })
  .superRefine((manifest, ctx) => {
    const weights = Object.values(manifest.anti_repetition.match_score_weights);
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(total - 1) > 0.001) {
      ctx.addIssue({
        code: "custom",
        path: ["anti_repetition", "match_score_weights"],
        message: `os pesos precisam somar 1.0 (somam ${total.toFixed(3)})`,
      });
    }

    if (
      manifest.anti_repetition.borderline_min >=
      manifest.anti_repetition.match_score_min
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["anti_repetition", "borderline_min"],
        message:
          "borderline_min precisa ser menor que match_score_min, senão o tier some",
      });
    }

    for (const [key, scope] of Object.entries(manifest.search_scopes)) {
      const duplicates = scope.sources.filter(
        (source, index) => scope.sources.indexOf(source) !== index,
      );
      if (duplicates.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["search_scopes", key, "sources"],
          message: `fontes repetidas: ${[...new Set(duplicates)].join(", ")}`,
        });
      }
    }
  });

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

/**
 * Pillar 4 is a warning rather than an error: the radar's own guard is
 * radar-scan refusing `--pillar=4-bastidor`, and the manifest ships today with
 * it listed under seasonal.pillars_alvo. Blocking on it would make the config
 * screen refuse every save until that pre-existing entry is resolved, which is
 * an editorial call, not a save-time one.
 */
function collectWarnings(manifest: unknown): ValidationIssue[] {
  const warnings: ValidationIssue[] = [];
  const doc = manifest as {
    search_scopes?: Record<string, { pillars_alvo?: string[] }>;
    cadence?: { pillars_by_day_base?: Record<string, string[]> };
  };

  for (const [key, scope] of Object.entries(doc.search_scopes ?? {})) {
    if (scope?.pillars_alvo?.includes(EXCLUDED_PILLAR)) {
      warnings.push({
        path: `search_scopes.${key}.pillars_alvo`,
        message: `${EXCLUDED_PILLAR} está fora do escopo do radar (vive nos stories) e radar-scan recusa --pillar=${EXCLUDED_PILLAR}`,
      });
    }
  }

  for (const [day, pillars] of Object.entries(
    doc.cadence?.pillars_by_day_base ?? {},
  )) {
    if (pillars?.includes(EXCLUDED_PILLAR)) {
      warnings.push({
        path: `cadence.pillars_by_day_base.${day}`,
        message: `${EXCLUDED_PILLAR} está fora do escopo do radar (vive nos stories)`,
      });
    }
  }

  return warnings;
}

/**
 * Avisos a partir do manifest já carregado. A tela de configuração precisa
 * deles para mostrar o que está torto sem reler o arquivo — quem lê arquivo é
 * a camada de armazenamento, não a página.
 */
export function manifestWarnings(manifest: unknown): ValidationIssue[] {
  return collectWarnings(manifest);
}

/** Validates the document as a whole, so an edit can never be saved in a state
 *  the pipeline would later choke on. */
export function validateManifestText(raw: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = parse(raw);
  } catch (error) {
    return {
      errors: [
        { path: "", message: `YAML inválido: ${(error as Error).message}` },
      ],
      warnings: [],
    };
  }

  const result = EditableManifest.safeParse(parsed);
  const errors = result.success
    ? []
    : result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));

  return { errors, warnings: collectWarnings(parsed) };
}
