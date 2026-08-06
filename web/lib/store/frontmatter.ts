import { readFile, writeFile } from "node:fs/promises";
import { isScalar, parseDocument, type Document } from "yaml";

export interface ParsedFile {
  doc: Document.Parsed;
  data: Record<string, unknown>;
  /** The frontmatter text, and where it sits inside the original file. */
  yamlText: string;
  yamlStart: number;
  yamlEnd: number;
  body: string;
}

const DELIMITER = "---";

export function parseFrontmatter(raw: string): ParsedFile {
  const lines = raw.split("\n");
  if (lines[0]?.trim() !== DELIMITER) {
    throw new Error("file does not start with a YAML frontmatter delimiter");
  }

  let end = 1;
  while (end < lines.length && lines[end].trim() !== DELIMITER) end++;
  if (end >= lines.length) throw new Error("unterminated YAML frontmatter");

  const yamlStart = lines[0].length + 1;
  const yamlText = lines.slice(1, end).join("\n");
  const yamlEnd = yamlStart + yamlText.length;

  const doc = parseDocument(yamlText);
  if (doc.errors.length > 0) {
    throw new Error(`invalid frontmatter YAML: ${doc.errors[0].message}`);
  }

  return {
    doc,
    data: (doc.toJS() ?? {}) as Record<string, unknown>,
    yamlText,
    yamlStart,
    yamlEnd,
    body: lines.slice(end + 1).join("\n"),
  };
}

/**
 * These files are Prettier-formatted, so re-emitting the whole document would
 * reflow it and bury a one-field change in a frontmatter-wide diff. Instead we
 * splice the exact byte range of each target value and leave the rest untouched.
 */
function renderScalar(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  throw new Error(`unsupported scalar for surgical patch: ${typeof value}`);
}

export function patchScalars(raw: string, patches: Record<string, unknown>): string {
  const parsed = parseFrontmatter(raw);
  const edits: { start: number; end: number; text: string }[] = [];
  const appended: string[] = [];

  for (const [key, value] of Object.entries(patches)) {
    const node = parsed.doc.get(key, true);
    if (node === undefined) {
      appended.push(`${key}: ${renderScalar(value)}`);
      continue;
    }
    if (!isScalar(node) || !node.range) {
      throw new Error(`\`${key}\` is not a plain scalar; refusing to patch it blindly`);
    }
    const [start, valueEnd] = node.range;
    edits.push({ start, end: valueEnd, text: renderScalar(value) });
  }

  let yamlText = parsed.yamlText;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    yamlText = yamlText.slice(0, edit.start) + edit.text + yamlText.slice(edit.end);
  }
  if (appended.length > 0) {
    const separator = yamlText.endsWith("\n") ? "" : "\n";
    yamlText += `${separator}${appended.join("\n")}\n`;
  }

  return raw.slice(0, parsed.yamlStart) + yamlText + raw.slice(parsed.yamlEnd);
}

export async function readFileWithFrontmatter(filePath: string): Promise<ParsedFile> {
  return parseFrontmatter(await readFile(filePath, "utf8"));
}

export async function patchFrontmatter(
  filePath: string,
  patches: Record<string, unknown>,
): Promise<void> {
  const raw = await readFile(filePath, "utf8");
  await writeFile(filePath, patchScalars(raw, patches), "utf8");
}
