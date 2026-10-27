import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseTrainingPeaksEmail } from "../src/lib/workout";
import { cadenceLabel, positionLabel, zoneLabel } from "../src/lib/timer";

// Real email, 2026-10-06: three "Ramp up in 4 steps" intervals, each a nested
// <ul> of four 4-minute steps alternating 220-235 W (under) and 240-250 W (over).
const html = readFileSync("fixtures/trainingpeaks-overunder-3x16.html", "utf8");
const parsed = parseTrainingPeaksEmail(html, { subject: "Schedule for Tuesday 10/06/2026 to Wednesday 10/07/2026" });
const w = parsed.days[0];

describe("over-under intervals (nested sub-steps)", () => {
  it("reads every sub-step and matches the planned time", () => {
    expect(w.title).toBe("Aerobic OverUnder 3x16 (4U / 4O / 4U / 4O) - 8 min RBI");
    expect(w.unparsed).toEqual([]);
    expect(w.warnings).toEqual([]);
    expect(w.blocks).toHaveLength(17);
    expect(w.totalSec).toBe(5400);
    expect(w.plannedSec).toBe(5400);
  });

  it("labels alternating targets Under and Over with step positions", () => {
    const first = w.blocks.slice(1, 5);
    expect(first.map((b) => b.title)).toEqual(["Under", "Over", "Under", "Over"]);
    expect(first.map((b) => `${b.target.watts?.lo}-${b.target.watts?.hi}`)).toEqual(["220-235", "240-250", "220-235", "240-250"]);
    expect(first.map((b) => b.part)).toEqual([1, 2, 3, 4].map((index) => ({ index, count: 4 })));
    expect(first.every((b) => b.kind === "work" && b.durationSec === 240)).toBe(true);
  });

  it("numbers the three intervals and their recoveries", () => {
    const sets = w.blocks.map((b) => (b.set ? `${b.set.index}/${b.set.count}` : ""));
    expect(sets).toEqual(["", "1/3", "1/3", "1/3", "1/3", "1/3", "2/3", "2/3", "2/3", "2/3", "2/3", "3/3", "3/3", "3/3", "3/3", "3/3", ""]);
  });

  it("cues up for the overs and down for the unders", () => {
    expect(w.blocks.slice(0, 7).map((b) => b.cue)).toEqual(["start", "work", "work", "recovery", "work", "recovery", "work"]);
  });

  it("shows readable labels", () => {
    expect(zoneLabel(w.blocks[2])).toBe("Over · Threshold");
    expect(zoneLabel(w.blocks[3])).toBe("Under · Tempo · Threshold");
    expect(positionLabel(w.blocks[7], w.blocks.length)).toBe("2 of 3 · 2/4");
    expect(positionLabel(w.blocks[0], w.blocks.length)).toBe("1 / 17");
  });

  it("parses the second day too", () => {
    expect(parsed.days[1].title).toBe("Endurance Miles 1.00hrs");
    expect(parsed.days[1].blocks).toHaveLength(1);
  });
});

describe("cadence", () => {
  it("gives the session-wide 80-100 rpm to every Under and Over, Open elsewhere", () => {
    expect(w.cadenceRpm).toEqual({ lo: 80, hi: 100 });
    const labels = w.blocks.map((b) => `${b.title}:${cadenceLabel(b)}`);
    expect(labels.slice(0, 6)).toEqual(["Warm up:Open", "Under:80–100 rpm", "Over:80–100 rpm", "Under:80–100 rpm", "Over:80–100 rpm", "Recovery:Open"]);
    expect(labels.at(-1)).toBe("Cool Down:Open");
  });

  it("keeps a step's own cadence over the session's", () => {
    const next = parsed.days[1];
    expect(next.blocks[0].target.cadenceRpm).toEqual({ lo: 80, hi: 95 });
  });
});
