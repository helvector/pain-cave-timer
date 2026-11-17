"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Workout } from "@/lib/workout/types";
import { Confirm } from "./Confirm";
import { Ride } from "./Ride";
import { useHeartRate } from "@/hooks/use-heart-rate";
import { PLAYHEAD_STYLES, type PlayheadStyle } from "@/lib/settings";
import { Summary } from "./Summary";
import { syntheticHr } from "@/lib/demo-hr";
import type { HrSample } from "@/lib/profile";
import { Splash } from "./Splash";
import { MetricIcon } from "./MetricIcon";
import { ResumeSheet, type ResumeOffer } from "./ResumeSheet";
import { clearLocal, newer, parseSession, readLocal, resumableWorkout, writeLocal, type RideSession } from "@/lib/ride-session";
import type { RideClock } from "./Ride";

const TOKEN_KEY = "pct.token";

interface ApiResult {
  date: string;
  workout?: Workout;
  days: Workout[];
  warnings: string[];
  error?: string;
  detail?: string;
  demo?: boolean;
}

type Phase =
  | { name: "loading" }
  | { name: "token"; message?: string }
  | { name: "error"; message: string }
  | { name: "confirm"; result: ApiResult; selected: Workout; offer?: ResumeOffer }
  | { name: "ride"; workout: Workout; resume?: RideClock & { hr: HrSample[] } }
  | { name: "done"; workout: Workout; elapsedSec: number; hr: HrSample[] };

function readToken(): string {
  try { return localStorage.getItem(TOKEN_KEY) ?? ""; } catch { return ""; }
}

/** The app, with the opening splash played once over it on page load. */
export function App() {
  const [splashDone, setSplashDone] = useState(false);
  const endSplash = useCallback(() => setSplashDone(true), []);
  return (
    <>
      <AppScreens />
      {!splashDone && <Splash onDone={endSplash} />}
    </>
  );
}

function AppScreens() {
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [tokenInput, setTokenInput] = useState("");
  const heartRate = useHeartRate();


  const params = useMemo(() => (typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search)), []);
  const demo = params.get("demo") === "1";
  // Demo only: ?fx=comet previews a "now" line style without saving it.
  const fxParam = params.get("fx");
  const fx = demo && PLAYHEAD_STYLES.includes(fxParam as PlayheadStyle) ? (fxParam as PlayheadStyle) : undefined;
  // Demo only: ?at=end starts 8 s before the finish with a realistic heart-rate trace.
  const atEnd = demo && params.get("at") === "end";
  // Demo only: ?bpm=142 simulates a connected strap so the pulse can be previewed.
  const demoBpm = demo && params.get("bpm") ? Number(params.get("bpm")) : undefined;
  // Demo only: ?wait=5 holds the loading screen that many seconds, to see it after the splash.
  const demoWaitMs = demo && params.get("wait") ? Math.min(30, Number(params.get("wait")) || 0) * 1000 : 0;
  const [simBpm, setSimBpm] = useState<number>();
  useEffect(() => {
    if (!demoBpm) return;
    const id = setInterval(() => setSimBpm(demoBpm + Math.round((Math.random() - 0.5) * 6)), 2000);
    return () => clearInterval(id);
  }, [demoBpm]);
  const liveBpm = demoBpm ? (simBpm ?? demoBpm) : heartRate.status === "connected" ? heartRate.bpm : undefined;

  // The ride in progress, saved on every clock change (and every 30 s) so a restart can resume it.
  // Always on this device; also on the server (not in demo), sent only when the clock changes.
  const saveSession = useCallback((w: Workout, st: RideClock & { hr: HrSample[]; clockChanged: boolean }) => {
    const s: RideSession = { v: 1, date: w.date, title: w.title, startedAt: st.startedAt, pausedAt: st.pausedAt, hr: st.hr, savedAt: Date.now() };
    writeLocal(demo, s);
    if (!demo && st.clockChanged) void sendRide("PUT", s);
  }, [demo]);
  const clearSession = useCallback(() => {
    clearLocal(demo);
    if (!demo) void sendRide("DELETE");
  }, [demo]);

  // fresh: read the mailbox instead of the saved copy (the Reload button).
  const load = useCallback(async (fresh = false) => {
    const token = readToken();
    if (!token && !demo) {
      setPhase({ name: "token" });
      return;
    }
    const qs = new URLSearchParams();
    if (params.get("date")) qs.set("date", params.get("date")!);
    if (demo) qs.set("demo", "1");
    if (fresh && !demo) qs.set("fresh", "1");
    if (demo && params.get("fixture")) qs.set("fixture", params.get("fixture")!);
    try {
      if (demoWaitMs) await new Promise((r) => setTimeout(r, demoWaitMs));
      // Any unfinished ride: this device's copy, and the server's (in parallel with the workout).
      const saved = demo ? Promise.resolve(undefined) : fetchSavedRide(token);
      const res = await fetch(`/api/workout?${qs}`, { headers: demo ? {} : { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const body = (await res.json()) as ApiResult;
      if (res.status === 401) {
        setPhase({ name: "token", message: "That token was rejected." });
        return;
      }
      if (!res.ok && !body.days?.length) {
        setPhase({ name: "error", message: body.detail ? `${body.error}: ${body.detail}` : body.error ?? `HTTP ${res.status}` });
        return;
      }
      const selected = body.workout ?? body.days.find((d) => !d.isRestDay) ?? body.days[0];
      if (!selected) {
        setPhase({ name: "error", message: body.warnings.join(" ") || "No workout found." });
        return;
      }
      const now = Date.now();
      const session = newer(readLocal(demo), await saved);
      const resumeWorkout = resumableWorkout(session, body.days, now);
      const offer = session && resumeWorkout ? { session, workout: resumeWorkout, at: now } : undefined;
      setPhase({ name: "confirm", result: body, selected: resumeWorkout ?? selected, offer });
    } catch (err) {
      setPhase({ name: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, [demo, demoWaitMs, params]);

  const reload = useCallback((fresh = false) => {
    setPhase({ name: "loading" });
    void load(fresh);
  }, [load]);
  const refresh = useCallback(() => reload(true), [reload]);
  const backToStart = useCallback(() => reload(false), [reload]);

  useEffect(() => {
    // Kick off the first load from a callback rather than the effect body itself.
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  if (phase.name === "loading") {
    return (
      <main className="screen center">
        <div className="loading">
          <MetricIcon metric="timer" size="large" className="loading__timer" />
          <p className="muted">Loading workout…</p>
        </div>
      </main>
    );
  }

  if (phase.name === "token") {
    return (
      <main className="screen center">
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            try { localStorage.setItem(TOKEN_KEY, tokenInput.trim()); } catch { /* private mode */ }
            backToStart();
          }}
        >
          <h1>Access token</h1>
          <p className="muted">{phase.message ?? "Paste the APP_TOKEN from the Vercel project. It is kept on this device only."}</p>
          <input value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="token" />
          <button className="primary" type="submit" disabled={!tokenInput.trim()}>Continue</button>
        </form>
      </main>
    );
  }

  if (phase.name === "error") {
    return (
      <main className="screen center">
        <div className="stack">
          <h1>Couldn&apos;t load the workout</h1>
          <p className="notice">{phase.message}</p>
          <div className="row">
            <button onClick={refresh}>Try again</button>
            <button onClick={() => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } setPhase({ name: "token" }); }}>Change token</button>
          </div>
        </div>
      </main>
    );
  }

  if (phase.name === "confirm") {
    const offer = phase.offer;
    return (
      <>
      <Confirm
        result={phase.result}
        selected={phase.selected}
        onSelect={(w) => setPhase({ name: "confirm", result: phase.result, selected: w })}
        onStart={() => setPhase({ name: "ride", workout: phase.selected })}
        onReload={refresh}
        heartRate={heartRate}
      />
      {offer && (
        <ResumeSheet
          offer={offer}
          onResume={() => setPhase({ name: "ride", workout: offer.workout, resume: { startedAt: offer.session.startedAt, pausedAt: offer.session.pausedAt, hr: offer.session.hr } })}
          onDiscard={() => { clearSession(); setPhase({ ...phase, offer: undefined }); }}
        />
      )}
      </>
    );
  }

  if (phase.name === "ride") {
    return (
      <Ride
        workout={phase.workout}
        bpm={liveBpm}
        playhead={fx}
        startAtSec={atEnd ? Math.max(0, phase.workout.totalSec - 8) : 0}
        seedHr={atEnd ? syntheticHr(phase.workout, phase.workout.totalSec - 8) : undefined}
        resume={phase.resume}
        onState={(st) => saveSession(phase.workout, st)}
        onDone={(elapsedSec, hr) => { clearSession(); setPhase({ name: "done", workout: phase.workout, elapsedSec, hr }); }}
        onExit={() => { clearSession(); backToStart(); }}
      />
    );
  }

  return <Summary workout={phase.workout} elapsedSec={phase.elapsedSec} hr={phase.hr} onDone={backToStart} />;
}

/** The server's copy of an unfinished ride, if any. Never blocks the app: failures mean "none". */
async function fetchSavedRide(token: string): Promise<RideSession | undefined> {
  try {
    const res = await fetch("/api/ride", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) return undefined;
    return parseSession((await res.json()).session);
  } catch {
    return undefined;
  }
}

/** Save or clear the server's copy. Fire and forget: the device copy is the one a restart relies on first. */
async function sendRide(method: "PUT" | "DELETE", s?: RideSession): Promise<void> {
  const token = readToken();
  if (!token) return;
  try {
    await fetch("/api/ride", {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(s ? { "Content-Type": "application/json" } : {}) },
      body: s ? JSON.stringify(s) : undefined,
    });
  } catch { /* offline: the device copy still has it */ }
}
