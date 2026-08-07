import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { BRIEF_STATES, type BriefState, type RadarPaths } from "../manifest";
import { planTransition, runTransition, TransitionError } from "./mv";

const SLUG = "2026-W99-001_teste";

function brief(fields: string): string {
  return `---
brief_id: 2026-W99-001
slug: ${SLUG}
updated_at: 2026-01-01T00:00:00-03:00
pillar: "2-decisao"
review_notes: |
  Nota anterior preservada.
hero_image_candidates:
  - index: 0
    local_path: ./store/media/pendente-aprovacao/${SLUG}__0.jpg
  - index: 1
    local_path: ./store/media/pendente-aprovacao/${SLUG}__1.jpg
${fields}
---

Corpo do brief.
`;
}

let paths: RadarPaths;

async function seed(frontmatterTail: string, mediaFiles = [`${SLUG}__0.jpg`, `${SLUG}__1.jpg`]) {
  const root = await mkdtemp(path.join(tmpdir(), "radar-mv-"));
  const briefsDir = {} as Record<BriefState, string>;
  const mediaDir = {} as Record<BriefState, string>;
  for (const state of BRIEF_STATES) {
    briefsDir[state] = path.join(root, "briefs", state);
    mediaDir[state] = path.join(root, "media", state);
    await mkdir(briefsDir[state], { recursive: true });
    await mkdir(mediaDir[state], { recursive: true });
  }
  paths = { briefsDir, mediaDir, mediaRoot: path.join(root, "media"), ledger: path.join(root, "ledger.jsonl") };

  await writeFile(path.join(briefsDir["pendente-aprovacao"], `${SLUG}.md`), brief(frontmatterTail));
  for (const file of mediaFiles) {
    await writeFile(path.join(mediaDir["pendente-aprovacao"], file), "bytes");
  }
}

async function ledgerEvents() {
  const raw = await readFile(paths.ledger, "utf8").catch(() => "");
  return raw.split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

describe("approve", () => {
  beforeEach(() => seed("hero_choice: 1"));

  it("moves the brief, keeps only the chosen photo and records the event", async () => {
    const result = await runTransition({ slug: SLUG, direction: "approve" }, paths);

    expect(result.applied).toBe(true);
    expect(await readdir(paths.briefsDir["pendente-aprovacao"])).toEqual([]);
    expect(await readdir(paths.briefsDir["pendente-publicacao"])).toEqual([`${SLUG}.md`]);
    expect(await readdir(paths.mediaDir["pendente-publicacao"])).toEqual([`${SLUG}__1.jpg`]);
    expect(await readdir(paths.mediaDir["pendente-aprovacao"])).toEqual([]);

    const [event] = await ledgerEvents();
    expect(event.event).toBe("mv-approved");
    expect(event.actor).toBe("app:radar-web");
    expect(event.from_dir).toBe("briefs/pendente-aprovacao");
    expect(event.to_dir).toBe("briefs/pendente-publicacao");
    expect(event.extra.hero_choice).toBe(1);
    expect(event.extra.media_kept).toBe(`${SLUG}__1.jpg`);
  });

  it("touches only updated_at in the frontmatter", async () => {
    const before = await readFile(path.join(paths.briefsDir["pendente-aprovacao"], `${SLUG}.md`), "utf8");
    await runTransition({ slug: SLUG, direction: "approve" }, paths);
    const after = await readFile(path.join(paths.briefsDir["pendente-publicacao"], `${SLUG}.md`), "utf8");

    const changed = before
      .split("\n")
      .map((line, index) => (line === after.split("\n")[index] ? null : index))
      .filter((index): index is number => index !== null);

    expect(changed).toHaveLength(1);
    expect(after.split("\n")[changed[0]]).toMatch(/^updated_at:/);
  });
});

describe("approve sem foto", () => {
  beforeEach(() => seed("hero_choice: null"));

  it("deletes every candidate and warns that the art will be generated", async () => {
    const result = await runTransition({ slug: SLUG, direction: "approve" }, paths);

    expect(await readdir(paths.mediaDir["pendente-aprovacao"])).toEqual([]);
    expect(await readdir(paths.mediaDir["pendente-publicacao"])).toEqual([]);
    expect(result.warnings.join(" ")).toContain("Smart Design");
  });
});

describe("regras duras", () => {
  it("refuses to approve when hero_choice is absent", async () => {
    await seed("format: post_feed_instagram");

    await expect(runTransition({ slug: SLUG, direction: "approve" }, paths)).rejects.toThrow(
      TransitionError,
    );
    expect(await readdir(paths.briefsDir["pendente-aprovacao"])).toEqual([`${SLUG}.md`]);
    expect(await readdir(paths.mediaDir["pendente-aprovacao"])).toHaveLength(2);
    expect(await ledgerEvents()).toEqual([]);
  });

  it("refuses a hero_choice with no matching candidate", async () => {
    await seed("hero_choice: 7");
    await expect(planTransition({ slug: SLUG, direction: "approve" }, paths)).rejects.toMatchObject({
      code: "hero_choice_out_of_range",
    });
  });

  it("refuses to operate on a brief outside pendente-aprovacao", async () => {
    await seed("hero_choice: 0");
    await runTransition({ slug: SLUG, direction: "approve" }, paths);

    await expect(planTransition({ slug: SLUG, direction: "approve" }, paths)).rejects.toMatchObject({
      code: "wrong_state",
    });
  });

  it("reports an unknown slug", async () => {
    await seed("hero_choice: 0");
    await expect(planTransition({ slug: "nao-existe", direction: "approve" }, paths)).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("warns when the chosen photo is missing from the cache", async () => {
    await seed("hero_choice: 1", [`${SLUG}__0.jpg`]);
    const plan = await planTransition({ slug: SLUG, direction: "approve" }, paths);
    expect(plan.mediaKept).toBeNull();
    expect(plan.warnings.join(" ")).toContain("não está no cache");
  });
});

describe("reject", () => {
  beforeEach(() => seed("hero_choice: 1"));

  it("moves to rejeitado, purges all media and appends the reason", async () => {
    const result = await runTransition(
      { slug: SLUG, direction: "reject", reason: "fonte fraca" },
      paths,
    );

    expect(result.mediaDeleted).toHaveLength(2);
    expect(await readdir(paths.briefsDir.rejeitado)).toEqual([`${SLUG}.md`]);
    expect(await readdir(paths.mediaDir["pendente-aprovacao"])).toEqual([]);
    expect(await readdir(paths.mediaDir.rejeitado)).toEqual([]);

    const content = await readFile(path.join(paths.briefsDir.rejeitado, `${SLUG}.md`), "utf8");
    expect(content).toContain("Nota anterior preservada.");
    expect(content).toMatch(/\[REJECT @ .+\] fonte fraca/);

    const [event] = await ledgerEvents();
    expect(event.event).toBe("mv-rejected");
    expect(event.extra.reason).toBe("fonte fraca");
    expect(event.extra.media_purged).toHaveLength(2);
  });

  it("records a placeholder when no reason is given", async () => {
    await runTransition({ slug: SLUG, direction: "reject" }, paths);
    const content = await readFile(path.join(paths.briefsDir.rejeitado, `${SLUG}.md`), "utf8");
    expect(content).toContain("(sem motivo)");
  });
});

describe("dry-run", () => {
  beforeEach(() => seed("hero_choice: 1"));

  it("changes nothing on disk", async () => {
    const result = await runTransition({ slug: SLUG, direction: "approve", dryRun: true }, paths);

    expect(result.applied).toBe(false);
    expect(result.mediaKept).toBe(`${SLUG}__1.jpg`);
    expect(await readdir(paths.briefsDir["pendente-aprovacao"])).toEqual([`${SLUG}.md`]);
    expect(await readdir(paths.mediaDir["pendente-aprovacao"])).toHaveLength(2);
    expect(await ledgerEvents()).toEqual([]);
  });
});
