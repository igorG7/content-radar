import { readFile } from "node:fs/promises";
import path from "node:path";
import { BRIEF_STATES, loadManifest, resolvePaths, type BriefState } from "@/lib/manifest";

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
};

function isBriefState(value: string): value is BriefState {
  return (BRIEF_STATES as readonly string[]).includes(value);
}

/**
 * store/media is a gitignored cache outside public/, so it needs an explicit
 * handler. Both segments come from the URL: the state is checked against the
 * known set, and the filename must survive basename() unchanged, which rejects
 * traversal before it reaches the filesystem.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ state: string; file: string }> },
) {
  const { state, file } = await params;

  if (!isBriefState(state)) {
    return new Response("unknown state", { status: 404 });
  }

  const fileName = decodeURIComponent(file);
  if (fileName !== path.basename(fileName) || fileName.startsWith(".")) {
    return new Response("invalid file name", { status: 400 });
  }

  const extension = path.extname(fileName).toLowerCase();
  const contentType = CONTENT_TYPES[extension];
  if (!contentType) {
    return new Response("unsupported media type", { status: 415 });
  }

  const paths = resolvePaths(await loadManifest());
  const mediaDir = paths.mediaDir[state];
  const filePath = path.resolve(mediaDir, fileName);
  if (filePath !== path.join(mediaDir, fileName)) {
    return new Response("invalid file name", { status: 400 });
  }

  try {
    const bytes = await readFile(filePath);
    return new Response(new Uint8Array(bytes), {
      headers: { "content-type": contentType, "cache-control": "private, max-age=60" },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Response("not found", { status: 404 });
    }
    throw error;
  }
}
