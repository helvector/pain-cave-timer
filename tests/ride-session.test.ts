import { describe, expect, it } from "vitest";
import { elapsedSec, MIN_RESUME_SEC, newer, parseSession, RESUME_WINDOW_MS, resumableWorkout, type RideSession } from "../src/lib/ride-session";
import type { Workout } from "../src/lib/workout/types";

const NOW = Date.parse("2026-11-14T18:00:00Z");
const ride = { date: "2026-11-14", title: "Aerobic Overunder 3x16", blocks: [{}], totalSec: 5400 } as unknown as Workout;
const gym = { date: "2026-11-14", title: "Cycling Specific Weight Work", blocks: [], totalSec: 0 } as unknown as Workout;
const session = (over: Partial<RideSession> = {}): RideSession => ({
  v: 1, date: "2026-11-14", title: "Aerobic Overunder 3x16",
  startedAt: NOW - 20 * 60_000, pausedAt: null, hr: [{ t: 0, bpm: 120 }, { t: 2, bpm: null }], savedAt: NOW - 60_000, ...over,
});

describe("ride session", () => {
  it("measures elapsed time by the wall clock, stopped while paused", () => {
    expect(elapsedSec(session(), NOW)).toBe(1200);
    expect(elapsedSec(session({ pausedAt: NOW - 5 * 60_000 }), NOW)).toBe(900);
  });

  it("offers an unfinished ride of today's workout back", () => {
    expect(resumableWorkout(session(), [gym, ride], NOW)).toBe(ride);
    expect(resumableWorkout(session({ pausedAt: NOW - 3 * 60 * 60_000, startedAt: NOW - 3.5 * 60 * 60_000 }), [ride], NOW)).toBe(ride);
  });

  it("doesn't offer a ride that's over, barely started, stale, or not in the list", () => {
    expect(resumableWorkout(session({ startedAt: NOW - 5400_000 }), [ride], NOW)).toBeUndefined();
    expect(resumableWorkout(session({ startedAt: NOW - (MIN_RESUME_SEC - 1) * 1000 }), [ride], NOW)).toBeUndefined();
    expect(resumableWorkout(session({ savedAt: NOW - RESUME_WINDOW_MS - 1 }), [ride], NOW)).toBeUndefined();
    expect(resumableWorkout(session({ title: "Something else" }), [ride], NOW)).toBeUndefined();
    expect(resumableWorkout(session({ date: "2026-11-13" }), [ride], NOW)).toBeUndefined();
    expect(resumableWorkout(session({ title: gym.title }), [gym], NOW)).toBeUndefined();
    expect(resumableWorkout(undefined, [ride], NOW)).toBeUndefined();
  });

  it("prefers the newer of the device and server copies", () => {
    const a = session({ savedAt: NOW - 10_000 });
    const b = session({ savedAt: NOW - 5_000, pausedAt: NOW - 5_000 });
    expect(newer(a, b)).toBe(b);
    expect(newer(b, a)).toBe(b);
    expect(newer(undefined, a)).toBe(a);
    expect(newer(a, undefined)).toBe(a);
  });

  it("round-trips through JSON and rejects anything else", () => {
    const s = session();
    expect(parseSession(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(parseSession(null)).toBeUndefined();
    expect(parseSession({ ...s, v: 2 })).toBeUndefined();
    expect(parseSession({ ...s, date: "14/11/2026" })).toBeUndefined();
    expect(parseSession({ ...s, startedAt: "soon" })).toBeUndefined();
    expect(parseSession({ ...s, hr: [{ t: 0, bpm: "fast" }] })).toBeUndefined();
    expect(parseSession({ ...s, title: "" })).toBeUndefined();
  });
});
