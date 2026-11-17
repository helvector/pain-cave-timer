import type { HrSample } from "./profile";
import type { Workout } from "./workout/types";

/**
 * A ride in progress, saved so a restart can pick it up. Time is wall-clock:
 * elapsed = (pausedAt ?? now) − startedAt, the same rule the ride screen uses,
 * so time spent with the app closed still counts (the bike kept recording).
 *
 * Kept on the device (instant, works offline) and on the server (survives a
 * cleared browser or a different device). The newer copy wins.
 */
export interface RideSession {
  v: 1;
  /** Which workout: its date and title. */
  date: string;
  title: string;
  /** Epoch ms; moved forward by pauses and by Back/Skip, exactly as on the ride screen. */
  startedAt: number;
  pausedAt: number | null;
  /** Heart-rate trace so far, so the profile line and end-of-ride card continue. */
  hr: HrSample[];
  /** When this copy was written (epoch ms). */
  savedAt: number;
}

/** Older than this and the ride isn't offered back, however little of it was ridden. */
export const RESUME_WINDOW_MS = 12 * 60 * 60 * 1000;
/** Rides shorter than this (in ridden seconds) aren't worth offering back. */
export const MIN_RESUME_SEC = 20;

export function elapsedSec(s: Pick<RideSession, "startedAt" | "pausedAt">, now: number): number {
  return ((s.pausedAt ?? now) - s.startedAt) / 1000;
}

/** The workout this session belongs to, if it can still be resumed. */
export function resumableWorkout(s: RideSession | undefined, days: Workout[], now: number): Workout | undefined {
  if (!s || now - s.savedAt > RESUME_WINDOW_MS) return undefined;
  const w = days.find((d) => d.date === s.date && d.title === s.title && d.blocks.length > 0);
  if (!w) return undefined;
  const t = elapsedSec(s, now);
  return t >= MIN_RESUME_SEC && t < w.totalSec ? w : undefined;
}

/** The newer of two copies. */
export function newer(a: RideSession | undefined, b: RideSession | undefined): RideSession | undefined {
  if (!a) return b;
  if (!b) return a;
  return b.savedAt > a.savedAt ? b : a;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_HR_SAMPLES = 12_000; // 2 s apart: over six hours

/** Check a session from storage or the network; undefined if it isn't one. */
export function parseSession(input: unknown): RideSession | undefined {
  if (!input || typeof input !== "object") return undefined;
  const r = input as Record<string, unknown>;
  const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  if (r.v !== 1 || typeof r.date !== "string" || !ISO_DATE.test(r.date)) return undefined;
  if (typeof r.title !== "string" || !r.title || r.title.length > 300) return undefined;
  if (!num(r.startedAt) || !num(r.savedAt) || !(r.pausedAt === null || num(r.pausedAt))) return undefined;
  const hr = Array.isArray(r.hr) ? r.hr : [];
  if (hr.length > MAX_HR_SAMPLES) return undefined;
  const samples: HrSample[] = [];
  for (const h of hr as Record<string, unknown>[]) {
    if (!h || !num(h.t) || !(h.bpm === null || num(h.bpm))) return undefined;
    samples.push({ t: h.t as number, bpm: h.bpm as number | null });
  }
  return {
    v: 1, date: r.date, title: r.title,
    startedAt: r.startedAt as number, pausedAt: r.pausedAt as number | null,
    hr: samples, savedAt: r.savedAt as number,
  };
}

/* ---- device copy ------------------------------------------------------- */

const key = (demo: boolean) => (demo ? "pct.ride.demo" : "pct.ride");

export function readLocal(demo: boolean): RideSession | undefined {
  try {
    const raw = localStorage.getItem(key(demo));
    return raw ? parseSession(JSON.parse(raw)) : undefined;
  } catch {
    return undefined;
  }
}

export function writeLocal(demo: boolean, s: RideSession): void {
  try { localStorage.setItem(key(demo), JSON.stringify(s)); } catch { /* private mode or full */ }
}

export function clearLocal(demo: boolean): void {
  try { localStorage.removeItem(key(demo)); } catch { /* ignore */ }
}
