import { readFile } from "node:fs/promises";
import path from "node:path";
import { get } from "@vercel/blob";

export const runtime = "nodejs";

/**
 * GET /fonts/display — the licensed display face (II Balfron), which is not
 * in the public repo. Served from a gitignored local copy when one exists
 * (owner and licensed contributors), otherwise from the private Blob store
 * (`fonts/ii-balfron.woff`, the owner's deployment). Anyone else gets a 404
 * and the CSS falls back to League Gothic.
 */
export async function GET() {
  const headers = { "Content-Type": "font/woff", "Cache-Control": "public, max-age=604800" };
  try {
    // Literal path so Next's file tracer only ever looks at this one file.
    const local = await readFile(path.join(process.cwd(), "private/fonts/ii-balfron.woff"));
    return new Response(new Uint8Array(local), { headers });
  } catch {
    // No local copy: try the Blob store.
  }
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const res = await get("fonts/ii-balfron.woff", { access: "private" });
      if (res && res.statusCode === 200) return new Response(res.stream, { headers });
    } catch {
      // Fall through to 404.
    }
  }
  return new Response("Display font not available", { status: 404 });
}
