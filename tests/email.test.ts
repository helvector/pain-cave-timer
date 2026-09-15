import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseTrainingPeaksEmail, pickWorkout, resolveDate } from "../src/lib/workout";

const html = readFileSync("fixtures/trainingpeaks-sweet-spot-3x15.html", "utf8");
const subject = "Schedule for Thursday 09/10/2026 to Friday 09/11/2026";

describe("parseTrainingPeaksEmail", () => {
  const parsed = parseTrainingPeaksEmail(html, { subject });

  it("finds both days with dates from the subject", () => {
    expect(parsed.warnings).toEqual([]);
    expect(parsed.days.map((d) => d.date)).toEqual(["2026-09-10", "2026-09-11"]);
    expect(parsed.days[1].isRestDay).toBe(true);
    expect(parsed.days[1].blocks).toEqual([]);
  });

  it("reads the header", () => {
    const w = parsed.days[0];
    expect(w.title).toBe("EM w/Sweet Spot Tempo 3x15min (5min RBI)");
    expect(w.plannedSec).toBe(5400);
    expect(w.tss).toBe(93);
    expect(w.description).toMatch(/^Sweet Spot = 220-235watts/);
  });

  it("produces the flat block list the runtime needs", () => {
    const w = parsed.days[0];
    expect(w.totalSec).toBe(5400);
    expect(w.unparsed).toEqual([]);
    expect(w.warnings).toEqual([]);
    expect(w.blocks.map((b) => [b.kind, b.durationSec, b.target.watts?.lo, b.target.watts?.hi])).toEqual([
      ["warmup", 1200, 138, 188],
      ["work", 900, 220, 235],
      ["recovery", 300, 3, 135],
      ["work", 900, 220, 235],
      ["recovery", 300, 3, 135],
      ["work", 900, 220, 235],
      ["cooldown", 900, 100, 135],
    ]);
    expect(w.blocks.map((b) => b.startSec)).toEqual([0, 1200, 2100, 2400, 3300, 3600, 4500]);
    expect(w.blocks.map((b) => b.cue)).toEqual(["start", "work", "recovery", "work", "recovery", "work", "recovery"]);
  });

  it("recovers set positions from the flattened list", () => {
    const sets = parsed.days[0].blocks.map((b) => (b.set ? `${b.set.index}/${b.set.count}` : ""));
    expect(sets).toEqual(["", "1/3", "1/3", "2/3", "2/3", "3/3", ""]);
  });

  it("keeps zone, cadence and notes", () => {
    const b = parsed.days[0].blocks[1];
    expect(b.title).toBe("Active");
    expect(b.target.zone).toEqual({ label: "Tempo-Threshold", codes: ["Z3", "Z4"] });
    expect(b.target.cadenceRpm).toEqual({ lo: 80, hi: 95 });
    expect(b.notes).toMatch(/^RPE: 7-8/);
    expect(b.target.raw).toBe("220-235 W");
  });

  it("picks the right day", () => {
    expect(pickWorkout(parsed.days, "2026-09-10")?.title).toMatch(/Sweet Spot/);
    expect(pickWorkout(parsed.days, "2026-09-11")?.isRestDay).toBe(true);
    expect(pickWorkout(parsed.days, "2026-09-12")).toBeUndefined();
  });

  it("warns instead of silently dropping when structure is missing", () => {
    const broken = html.replace("<ol>", "<div>").replace("</ol>", "</div>");
    const p = parseTrainingPeaksEmail(broken, { subject });
    expect(p.days[0].blocks).toEqual([]);
    expect(p.days[0].warnings.join(" ")).toMatch(/No structured steps/);
  });
});

describe("resolveDate", () => {
  it("uses the subject year", () => {
    expect(resolveDate("Thursday, September 10", subject)).toBe("2026-09-10");
  });
  it("falls back to received date and rolls over New Year", () => {
    expect(resolveDate("Friday, January 2", undefined, new Date("2026-12-31T21:00:00Z"))).toBe("2027-01-02");
    expect(resolveDate("Friday, January 2", undefined, new Date("2026-01-01T21:00:00Z"))).toBe("2026-01-02");
  });
});
