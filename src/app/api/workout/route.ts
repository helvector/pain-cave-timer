import { NextResponse, type NextRequest } from "next/server";
import { createImapSource, mailConfigFromEnv } from "@/lib/mail";
import { fetchWorkoutFor } from "@/lib/workout/fetch-today";
import { appTimeZone, todayIn } from "@/lib/date";

// imapflow needs Node sockets, and the result must never be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/workout?date=yyyy-mm-dd
 * Authorization: Bearer <APP_TOKEN>
 *
 * Returns today's workout (or the requested date) parsed from the newest
 * TrainingPeaks email. The deployment is public, so a shared token gates it.
 */
export async function GET(req: NextRequest) {
  const token = process.env.APP_TOKEN?.trim();
  if (!token) return NextResponse.json({ error: "APP_TOKEN is not configured" }, { status: 500 });
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (provided !== token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dateParam = req.nextUrl.searchParams.get("date");
  if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: "date must be yyyy-mm-dd" }, { status: 400 });
  }
  const date = dateParam ?? todayIn(appTimeZone());
  const ftp = process.env.FTP_WATTS ? Number(process.env.FTP_WATTS) : undefined;

  try {
    const source = createImapSource(mailConfigFromEnv());
    const result = await fetchWorkoutFor(source, date, { ftp });
    return NextResponse.json({ date, ...result }, { status: result.workout ? 200 : 404 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Never echo credentials; the message from imapflow is safe but keep it short.
    return NextResponse.json({ error: "Mail fetch failed", detail: message.slice(0, 200) }, { status: 502 });
  }
}
