import path from "node:path";
import { BRIEF_STATES, type BriefState } from "@/lib/manifest";
import { radarStore } from "@/lib/store";

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
 * traversal before it reaches the storage layer.
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

  const contentType = CONTENT_TYPES[path.extname(fileName).toLowerCase()];
  if (!contentType) {
    return new Response("unsupported media type", { status: 415 });
  }

  const bytes = await radarStore().lerMidia(state, fileName);
  if (!bytes) {
    return new Response("not found", { status: 404 });
  }

  return new Response(bytes, {
    headers: { "content-type": contentType, "cache-control": "private, max-age=60" },
  });
}
