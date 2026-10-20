import { NextResponse, type NextRequest } from "next/server";
import { get, put } from "@vercel/blob";
import { DEFAULT_SETTINGS, validateSettings, type Settings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATH = "settings.json";

async function readSettings(): Promise<Settings> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return DEFAULT_SETTINGS;
  try {
    const res = await get(PATH, { access: "private", useCache: false });
    if (!res || res.statusCode !== 200) return DEFAULT_SETTINGS;
    const parsed = validateSettings(JSON.parse(await new Response(res.stream).text()));
    return parsed.ok ? { ...parsed.settings, updatedAt: res.blob.uploadedAt.toISOString() } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** GET /api/settings — zones and playhead style. Not secret, so no token. */
export async function GET() {
  return NextResponse.json(await readSettings(), { headers: { "Cache-Control": "no-store" } });
}

/** PUT /api/settings — save from /admin. Authorization: Bearer <APP_TOKEN>. */
export async function PUT(req: NextRequest) {
  const token = process.env.APP_TOKEN?.trim();
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token || provided !== token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Settings storage is not configured" }, { status: 500 });

  const parsed = validateSettings(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  await put(PATH, JSON.stringify(parsed.settings, null, 2), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
  return NextResponse.json({ ...parsed.settings, updatedAt: new Date().toISOString() });
}
