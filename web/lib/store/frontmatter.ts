import { readFile, writeFile } from "node:fs/promises";
import { isScalar, parseDocument, stringify, type Document } from "yaml";

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
  if (typeof value === "string") {
    // stringify() quotes only when the value would otherwise be ambiguous, which
    // keeps plain values (timestamps, slugs) unquoted like the rest of the store.
    if (value.includes("\n")) {
      throw new Error("multi-line strings need appendToTextBlock, not a scalar patch");
    }
    return stringify(value).trimEnd();
  }
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

/**
 * Append a line to a multi-line text field, emitting it as a block scalar.
 * Fields like review_notes appear both quoted and as `|` blocks; re-emitting as
 * a block keeps the existing lines byte-identical when it already was one, so
 * the diff is just the appended line.
 */
export function appendToTextBlock(raw: string, key: string, line: string): string {
  const parsed = parseFrontmatter(raw);
  const node = parsed.doc.get(key, true);
  const indent = "  ";

  const previous =
    node === undefined ? "" : isScalar(node) && typeof node.value === "string" ? node.value : null;
  if (previous === null) {
    throw new Error(`\`${key}\` is not a text field; refusing to append to it`);
  }

  const merged = [...previous.split("\n"), line]
    .map((entry) => entry.trimEnd())
    .filter((entry, index, entries) => entry !== "" || index < entries.length - 1)
    .map((entry) => (entry === "" ? "" : `${indent}${entry}`))
    .join("\n");
  const block = `|\n${merged}`;

  if (node === undefined) {
    const yamlText = parsed.yamlText.endsWith("\n") ? parsed.yamlText : `${parsed.yamlText}\n`;
    return (
      raw.slice(0, parsed.yamlStart) +
      `${yamlText}${key}: ${block}\n` +
      raw.slice(parsed.yamlEnd)
    );
  }

  const [start, valueEnd] = (node as { range: [number, number, number] }).range;
  const yamlText =
    parsed.yamlText.slice(0, start) + block + parsed.yamlText.slice(valueEnd);
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
