import { NextResponse, type NextRequest } from "next/server";
import { del, get, put } from "@vercel/blob";
import { parseSession } from "@/lib/ride-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The ride in progress, so a restart (or another device) can resume it.
 * GET / PUT / DELETE, all with Authorization: Bearer <APP_TOKEN>.
 * One file per Vercel environment: the Blob store is shared by all of them.
 */
const path = () => `ride/${process.env.VERCEL_ENV || "development"}.json`;

function denied(req: NextRequest): NextResponse | undefined {
  const token = process.env.APP_TOKEN?.trim();
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token || provided !== token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Storage is not configured" }, { status: 500 });
  return undefined;
}

export async function GET(req: NextRequest) {
  const no = denied(req);
  if (no) return no;
  try {
    const res = await get(path(), { access: "private", useCache: false });
    if (!res || res.statusCode !== 200) return NextResponse.json({ session: null }, { headers: { "Cache-Control": "no-store" } });
    const session = parseSession(JSON.parse(await new Response(res.stream).text())) ?? null;
    return NextResponse.json({ session }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ session: null }, { headers: { "Cache-Control": "no-store" } });
  }
}

export async function PUT(req: NextRequest) {
  const no = denied(req);
  if (no) return no;
  const session = parseSession(await req.json().catch(() => null));
  if (!session) return NextResponse.json({ error: "Not a ride session" }, { status: 400 });
  await put(path(), JSON.stringify(session), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const no = denied(req);
  if (no) return no;
  try { await del(path()); } catch { /* already gone */ }
  return NextResponse.json({ ok: true });
}
