import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { beforeAll, describe, expect, it } from "vitest";
import { patchManifest } from "./manifest-edit";
import { validateManifestText } from "./validate";

const MANIFEST = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../manifest.yaml",
);

let raw: string;
beforeAll(async () => {
  raw = await readFile(MANIFEST, "utf8");
});

function changedLines(before: string, after: string) {
  const a = before.split("\n");
  const b = after.split("\n");
  return {
    added: b.length - a.length,
    differing: a.filter((line, i) => line !== b[i]).length,
  };
}

describe("patchManifest", () => {
  it("changes a scalar without touching anything else", () => {
    const output = patchManifest(raw, [
      { path: ["funnel", "candidates_per_week_target"], value: 12 },
    ]);
    expect(parse(output).funnel.candidates_per_week_target).toBe(12);
    expect(changedLines(raw, output)).toEqual({ added: 0, differing: 1 });
  });

  it("keeps the comments that carry the reasoning", () => {
    const output = patchManifest(raw, [
      { path: ["anti_repetition", "match_score_min"], value: 0.6 },
    ]);
    for (const comment of [
      "resolveu §11.I",
      "INALTERADOS na calibração §11.V",
      "anti-bot",
      "Lead a confirmar",
    ]) {
      expect(output).toContain(comment);
    }
  });

  it("renders a short source list inline", () => {
    const output = patchManifest(raw, [
      {
        path: ["search_scopes", "trends", "sources"],
        value: ["fipezap", "abrainc"],
      },
    ]);
    expect(output).toContain('\n      ["fipezap", "abrainc"]');
    expect(parse(output).search_scopes.trends.sources).toEqual([
      "fipezap",
      "abrainc",
    ]);
  });

  it("keeps a long source list in the file's multi-line style", () => {
    const sources = parse(raw).search_scopes.local.sources as string[];
    const output = patchManifest(raw, [
      {
        path: ["search_scopes", "local", "sources"],
        value: [...sources, "prefeitura-nova"],
      },
    ]);

    expect(parse(output).search_scopes.local.sources).toContain(
      "prefeitura-nova",
    );
    expect(output).toContain('\n        "prefeitura-nova",\n');

    // The edit is purely additive: drop the new line and the file is byte-identical.
    const withoutNewLine = output
      .split("\n")
      .filter((line) => !line.includes("prefeitura-nova"))
      .join("\n");
    expect(withoutNewLine).toBe(raw);
  });

  it("refuses an unknown path", () => {
    expect(() =>
      patchManifest(raw, [{ path: ["nao", "existe"], value: 1 }]),
    ).toThrow(/caminho inexistente/);
  });
});

describe("validateManifestText", () => {
  it("accepts the manifest as it ships", () => {
    expect(validateManifestText(raw).errors).toEqual([]);
  });

  it("rejects weights that stop summing to 1.0", () => {
    const output = patchManifest(raw, [
      {
        path: ["anti_repetition", "match_score_weights", "pillar_fit"],
        value: 0.5,
      },
    ]);
    expect(validateManifestText(output).errors).toContainEqual(
      expect.objectContaining({ path: "anti_repetition.match_score_weights" }),
    );
  });

  it("rejects a borderline floor at or above the promote threshold", () => {
    const output = patchManifest(raw, [
      { path: ["anti_repetition", "borderline_min"], value: 0.7 },
    ]);
    expect(validateManifestText(output).errors[0].message).toMatch(
      /menor que match_score_min/,
    );
  });

  it("rejects an empty source list", () => {
    const output = patchManifest(raw, [
      { path: ["search_scopes", "cases", "sources"], value: [] },
    ]);
    expect(validateManifestText(output).errors).toHaveLength(1);
  });

  it("rejects duplicated sources", () => {
    const output = patchManifest(raw, [
      {
        path: ["search_scopes", "cases", "sources"],
        value: ["caixa", "caixa"],
      },
    ]);
    expect(validateManifestText(output).errors[0].message).toMatch(/repetidas/);
  });

  it("warns about pillar 4 without blocking the save", () => {
    const output = patchManifest(raw, [
      {
        path: ["cadence", "pillars_by_day_base", "quarta"],
        value: ["4-bastidor"],
      },
    ]);
    const { errors, warnings } = validateManifestText(output);
    expect(errors).toEqual([]);
    expect(warnings.map((w) => w.path)).toContain(
      "cadence.pillars_by_day_base.quarta",
    );
  });

  it("ships with no outstanding warnings", () => {
    expect(validateManifestText(raw).warnings).toEqual([]);
  });
});
