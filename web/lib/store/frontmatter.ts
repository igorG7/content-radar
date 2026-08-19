import { readFile, writeFile } from "node:fs/promises";
import {
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  stringify,
  type Document,
} from "yaml";

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
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (typeof value === "string") {
    // stringify() quotes only when the value would otherwise be ambiguous, which
    // keeps plain values (timestamps, slugs) unquoted like the rest of the store.
    if (value.includes("\n")) {
      throw new Error(
        "multi-line strings need appendToTextBlock, not a scalar patch",
      );
    }
    return stringify(value).trimEnd();
  }
  throw new Error(`unsupported scalar for surgical patch: ${typeof value}`);
}

export function patchScalars(
  raw: string,
  patches: Record<string, unknown>,
): string {
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
      throw new Error(
        `\`${key}\` is not a plain scalar; refusing to patch it blindly`,
      );
    }
    const [start, valueEnd] = node.range;
    edits.push({ start, end: valueEnd, text: renderScalar(value) });
  }

  let yamlText = parsed.yamlText;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    yamlText =
      yamlText.slice(0, edit.start) + edit.text + yamlText.slice(edit.end);
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
export function appendToTextBlock(
  raw: string,
  key: string,
  line: string,
): string {
  const parsed = parseFrontmatter(raw);
  const node = parsed.doc.get(key, true);
  const indent = "  ";

  const previous =
    node === undefined
      ? ""
      : isScalar(node) && typeof node.value === "string"
        ? node.value
        : null;
  if (previous === null) {
    throw new Error(`\`${key}\` is not a text field; refusing to append to it`);
  }

  const merged = [...previous.split("\n"), line]
    .map((entry) => entry.trimEnd())
    .filter(
      (entry, index, entries) => entry !== "" || index < entries.length - 1,
    )
    .map((entry) => (entry === "" ? "" : `${indent}${entry}`))
    .join("\n");
  const block = `|\n${merged}`;

  if (node === undefined) {
    const yamlText = parsed.yamlText.endsWith("\n")
      ? parsed.yamlText
      : `${parsed.yamlText}\n`;
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

export async function readFileWithFrontmatter(
  filePath: string,
): Promise<ParsedFile> {
  return parseFrontmatter(await readFile(filePath, "utf8"));
}

export async function patchFrontmatter(
  filePath: string,
  patches: Record<string, unknown>,
): Promise<void> {
  const raw = await readFile(filePath, "utf8");
  await writeFile(filePath, patchScalars(raw, patches), "utf8");
}

/**
 * Surgical patch for fields `patchScalars` refuses: multi-line text, sequences
 * and nested maps — what the brief editor writes.
 *
 * Same principle, wider aim: instead of the value alone, splice the whole
 * `key: value` entry, from the key's first byte to the end of its value. That
 * keeps indentation trivial (the entry is rendered from column zero, like every
 * frontmatter key) and leaves every other line byte-identical.
 *
 * `lineWidth: 0` disables wrapping. Without it the emitter folds long strings at
 * 80 columns, which is what corrupted a headline before: a line-folded value is
 * still valid YAML, but any consumer parsing line-by-line reads only the first
 * fragment.
 */
/**
 * Keeps the field looking the way it already looked. Without this the emitter
 * picks its own style — a literal block (`|`) comes back folded (`>`), which
 * re-wraps every paragraph, and a quoted one-liner loses its quotes. Both are
 * valid YAML and both bury a one-field edit in a file-wide diff.
 */
type EstiloYaml = NonNullable<Parameters<typeof stringify>[2]>;

function estiloDe(anterior: unknown, valor: unknown): EstiloYaml {
  const multilinha = typeof valor === "string" && valor.includes("\n");
  const tipo = isScalar(anterior) ? anterior.type : undefined;

  // lineWidth: 0 desliga a dobra. Ela é o defeito que esta função corrige — o
  // store guarda os valores em uma linha só, e só o brief que passou pelo editor
  // antigo saiu dobrado em 80 colunas.
  if (multilinha) {
    return {
      lineWidth: 0,
      blockQuote: tipo === "BLOCK_FOLDED" ? "folded" : "literal",
    };
  }
  // Um valor de uma linha herda as aspas (ou a ausência delas) do que estava lá.
  // defaultKeyType junto, senão a chave também ganha aspas.
  return tipo?.startsWith("QUOTE_")
    ? { lineWidth: 0, defaultStringType: tipo, defaultKeyType: "PLAIN" }
    : { lineWidth: 0 };
}

/**
 * Prettier formats the store, and it writes sequences in flow style — inline
 * when they fit, otherwise bracketed one item per line with a trailing comma.
 * The YAML emitter would produce a block sequence instead, which is valid and
 * would turn a one-item change into a whole-list diff.
 *
 * Items are rendered plain, like the store keeps them; the manifest's renderer
 * double-quotes, which is that file's convention, not this one's.
 */
const LARGURA_MAX = 80;

/** Igualdade estrutural — o suficiente para o que cabe em frontmatter. */
function iguais(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => iguais(item, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a),
      kb = Object.keys(b);
    return (
      ka.length === kb.length &&
      ka.every((k) =>
        iguais(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k],
        ),
      )
    );
  }
  return false;
}

function renderSeqFluxo(chave: string, valores: unknown[]): string {
  const itens = valores.map((v) =>
    stringify(v, null, { lineWidth: 0 }).trimEnd(),
  );

  const inline = `${chave}: [${itens.join(", ")}]`;
  if (inline.length <= LARGURA_MAX) return inline;

  // Não coube: o Prettier desce o colchete para a linha seguinte, um item por
  // linha, com vírgula final.
  return `${chave}:\n  [\n${itens.map((i) => `    ${i},`).join("\n")}\n  ]`;
}

export function patchFields(
  raw: string,
  patches: Record<string, unknown>,
): string {
  const parsed = parseFrontmatter(raw);
  const contents = parsed.doc.contents;
  if (!isMap(contents)) throw new Error("frontmatter is not a mapping");

  const edits: { start: number; end: number; text: string }[] = [];
  const appended: string[] = [];

  for (const [key, value] of Object.entries(patches)) {
    // O editor envia o formulário inteiro a cada gravação. Reescrever campo que
    // não mudou é o que produz diff sem conteúdo — e é onde a fidelidade de
    // estilo seria exigida. Comparar antes torna a exigência desnecessária:
    // campo intocado permanece byte a byte como estava.
    if (key in parsed.data && iguais(parsed.data[key], value)) continue;

    const pair = contents.items.find(
      (item) => isScalar(item.key) && item.key.value === key,
    );
    // Sequência que já estava em fluxo continua em fluxo, no recuo do Prettier.
    const emFluxo =
      Array.isArray(value) && isSeq(pair?.value) && pair.value.flow;
    const rendered = emFluxo
      ? renderSeqFluxo(key, value as unknown[])
      : stringify(
          { [key]: value },
          null,
          estiloDe(pair?.value, value),
        ).trimEnd();

    if (!pair?.value) {
      appended.push(rendered);
      continue;
    }

    const start = (pair.key as { range: [number, number, number] }).range[0];
    let end = (pair.value as { range: [number, number, number] }).range[1];
    // The value's range can swallow the newline that separates it from the next
    // key; back off so the separator survives untouched.
    while (end > start && /\s/.test(parsed.yamlText[end - 1])) end--;

    edits.push({ start, end, text: rendered });
  }

  let yamlText = parsed.yamlText;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    yamlText =
      yamlText.slice(0, edit.start) + edit.text + yamlText.slice(edit.end);
  }
  if (appended.length > 0) {
    const separator = yamlText.endsWith("\n") ? "" : "\n";
    yamlText += `${separator}${appended.join("\n")}\n`;
  }

  return raw.slice(0, parsed.yamlStart) + yamlText + raw.slice(parsed.yamlEnd);
}

export async function replaceFrontmatterFields(
  filePath: string,
  patches: Record<string, unknown>,
): Promise<void> {
  const raw = await readFile(filePath, "utf8");
  await writeFile(filePath, patchFields(raw, patches), "utf8");
}
