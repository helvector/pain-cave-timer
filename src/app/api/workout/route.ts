import { after, NextResponse, type NextRequest } from "next/server";
import { createImapSource, mailConfigFromEnv } from "@/lib/mail";
import { blobCacheStore } from "@/lib/mail/cache";
import { loadWorkout } from "@/lib/workout/load";
import { appTimeZone, todayIn } from "@/lib/date";
import { demoWorkouts, isDemoFixture } from "@/lib/workout/demo";
import { pickWorkout } from "@/lib/workout";

// imapflow needs Node sockets, and the result must never be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/workout?date=yyyy-mm-dd[&fresh=1]
 * Authorization: Bearer <APP_TOKEN>
 *
 * Returns today's workout (or the requested date) parsed from the newest
 * TrainingPeaks emails. Answers from the saved copy of the emails when it
 * covers the date (filled by /api/cron/refresh); otherwise, or with
 * fresh=1, reads the mailbox and saves what it found. The deployment is
 * public, so a shared token gates it.
 */
export async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get("date");
  if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: "date must be yyyy-mm-dd" }, { status: 400 });
  }
  const date = dateParam ?? todayIn(appTimeZone());
  const ftp = process.env.FTP_WATTS ? Number(process.env.FTP_WATTS) : undefined;
  const thr = process.env.THR_BPM ? Number(process.env.THR_BPM) : undefined;

  // Demo mode: the redacted fixture, no mailbox, no token. Nothing private in it.
  if (req.nextUrl.searchParams.get("demo") === "1") {
    const fixture = req.nextUrl.searchParams.get("fixture");
    const days = demoWorkouts(date, { ftp, thr, fixture: isDemoFixture(fixture) ? fixture : undefined });
    return NextResponse.json({ date, workout: pickWorkout(days, date), days, warnings: [], demo: true });
  }

  const token = process.env.APP_TOKEN?.trim();
  if (!token) return NextResponse.json({ error: "APP_TOKEN is not configured" }, { status: 500 });
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (provided !== token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const started = Date.now();
  try {
    const { save, ...result } = await loadWorkout({
      date,
      live: () => createImapSource(mailConfigFromEnv()),
      store: blobCacheStore(),
      fresh: req.nextUrl.searchParams.get("fresh") === "1",
      opts: { ftp, thr },
    });
    // Save the emails after responding; a failed save only means the next load reads the mailbox again.
    if (save) after(() => save().catch((err) => console.error("mail cache write failed", err)));
    const durationMs = Date.now() - started;
    console.info(`workout ${date} source=${result.source} ${durationMs}ms`);
    return NextResponse.json(
      { date, ...result, durationMs },
      { status: result.workout ? 200 : 404, headers: { "Server-Timing": `${result.source};dur=${durationMs}` } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Never echo credentials; the message from imapflow is safe but keep it short.
    return NextResponse.json({ error: "Mail fetch failed", detail: message.slice(0, 200) }, { status: 502 });
  }
}
