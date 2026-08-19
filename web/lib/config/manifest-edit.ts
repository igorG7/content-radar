import { isSeq, parseDocument, stringify } from "yaml";

export type ConfigPath = (string | number)[];

export interface ConfigEdit {
  path: ConfigPath;
  value: unknown;
}

/** Prettier's YAML output, which this file is formatted with. */
const MAX_WIDTH = 80;

function renderScalar(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (typeof value === "string") {
    if (value.includes("\n"))
      throw new Error("multi-line strings are not editable here");
    return stringify(value).trimEnd();
  }
  throw new Error(`unsupported value: ${typeof value}`);
}

function renderFlowSeq(values: unknown[], bracketIndent: number): string {
  // The file double-quotes list entries. Re-rendering them plain would make
  // every line of the list differ just to add one item.
  const items = values.map((value) =>
    typeof value === "string" ? JSON.stringify(value) : renderScalar(value),
  );
  const singleLine = `[${items.join(", ")}]`;
  if (bracketIndent + singleLine.length <= MAX_WIDTH) return singleLine;

  const inner = " ".repeat(bracketIndent + 2);
  return `[\n${items.map((item) => `${inner}${item},`).join("\n")}\n${" ".repeat(bracketIndent)}]`;
}

function columnOf(raw: string, offset: number): number {
  return offset - (raw.lastIndexOf("\n", offset - 1) + 1);
}

/**
 * Replaces only the byte range of each edited value. manifest.yaml carries the
 * reasoning behind past decisions in comments (§11.V references, sources ruled
 * out for anti-bot, leads still to confirm) — re-emitting the document would
 * survive the comments but reflow everything else, so a one-field change would
 * arrive as a whole-file diff. Splicing keeps the change where the change is.
 */
export function patchManifest(raw: string, edits: ConfigEdit[]): string {
  const doc = parseDocument(raw);
  if (doc.errors.length > 0) {
    throw new Error(`manifest.yaml inválido: ${doc.errors[0].message}`);
  }

  const splices = edits.map(({ path, value }) => {
    const node = doc.getIn(path, true) as
      { range?: [number, number, number] } | undefined;
    if (!node?.range) {
      throw new Error(`caminho inexistente no manifest: ${path.join(".")}`);
    }
    const [start, valueEnd] = node.range;

    const text = Array.isArray(value)
      ? renderFlowSeq(value, columnOf(raw, start))
      : renderScalar(value);

    if (Array.isArray(value) && !isSeq(doc.getIn(path, true))) {
      throw new Error(`${path.join(".")} não é uma lista no manifest`);
    }

    return { start, end: valueEnd, text };
  });

  let output = raw;
  for (const splice of splices.sort((a, b) => b.start - a.start)) {
    output =
      output.slice(0, splice.start) + splice.text + output.slice(splice.end);
  }
  return output;
}
