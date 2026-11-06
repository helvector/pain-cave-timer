import { NextResponse, type NextRequest } from "next/server";
import { createImapSource, mailConfigFromEnv } from "@/lib/mail";
import { blobCacheStore, refreshCache } from "@/lib/mail/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/refresh — run by Vercel Cron (vercel.json) after the nightly
 * email usually lands, and again early morning. Reads the newest emails and
 * saves them so page loads don't open the mailbox. Vercel sends
 * `Authorization: Bearer <CRON_SECRET>` when that env var is set.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const store = blobCacheStore();
  if (!store) return NextResponse.json({ error: "Blob storage is not configured" }, { status: 500 });

  const started = Date.now();
  try {
    const cache = await refreshCache(createImapSource(mailConfigFromEnv()), store);
    return NextResponse.json({ fetchedAt: cache.fetchedAt, emails: cache.messages.length, newest: cache.messages[0]?.receivedAt, durationMs: Date.now() - started });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Refresh failed", detail: message.slice(0, 200) }, { status: 502 });
  }
}
