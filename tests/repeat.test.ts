import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseTrainingPeaksEmail } from "../src/lib/workout";
import { parseRepeatCount } from "../src/lib/workout/email-html";
import { positionLabel, zoneLabel } from "../src/lib/timer";

// Real email, 2026-10-13: a "Repeat 4 times" item whose nested <ul> holds a
// labelled 8-min Steady State and a 4-min Recovery; next day is a ladder of
// "Ramp up/down in 4 steps" items that must stay single-pass.
const parsed = parseTrainingPeaksEmail(readFileSync("fixtures/trainingpeaks-steadystate-4x8.html", "utf8"), {
  subject: "Schedule for Tuesday 10/13/2026 to Wednesday 10/14/2026",
});
const [today, tomorrow] = parsed.days;

describe("Repeat N times", () => {
  it("rides the listed steps N times and matches the planned time", () => {
    expect(today.title).toBe("Steady State Intervals 4x8min (4min RBI)");
    expect(today.unparsed).toEqual([]);
    expect(today.warnings).toEqual([]);
    expect(today.blocks).toHaveLength(10);
    expect(today.totalSec).toBe(4200);
    expect(today.plannedSec).toBe(4200);
  });

  it("uses each step's own label and kind, not Over/Under", () => {
    const reps = today.blocks.slice(1, 9);
    expect(reps.map((b) => b.title)).toEqual(Array.from({ length: 4 }, () => ["Steady State", "Recovery"]).flat());
    expect(reps.map((b) => b.kind)).toEqual(Array.from({ length: 4 }, () => ["work", "recovery"]).flat());
    expect(reps.map((b) => b.durationSec)).toEqual(Array.from({ length: 4 }, () => [480, 240]).flat());
    expect(reps.every((b) => b.part === undefined)).toBe(true);
    expect(zoneLabel(reps[0])).toBe("Threshold");
  });

  it("numbers each repeat 1 of 4 … 4 of 4, recovery included", () => {
    expect(today.blocks.map((b) => (b.set ? `${b.set.index}/${b.set.count}` : ""))).toEqual(
      ["", "1/4", "1/4", "2/4", "2/4", "3/4", "3/4", "4/4", "4/4", ""],
    );
    expect(positionLabel(today.blocks[5], today.blocks.length)).toBe("3 of 4");
  });

  it("alternates work and recovery cues", () => {
    expect(today.blocks.map((b) => b.cue)).toEqual(
      ["start", "work", "recovery", "work", "recovery", "work", "recovery", "work", "recovery", "recovery"],
    );
  });

  it("leaves ramp ladders as single passes", () => {
    expect(tomorrow.title).toBe("Endurance Power Ladders at self-selected cadence");
    expect(tomorrow.blocks).toHaveLength(13);
    expect(tomorrow.totalSec).toBe(3600);
    expect(tomorrow.plannedSec).toBe(3600);
    expect(tomorrow.unparsed).toEqual([]);
  });
});

describe("parseRepeatCount", () => {
  it.each([
    ["Repeat 4 times", 4],
    ["Repeat 3x", 3],
    ["5 x", 5],
    ["6 sets", 6],
  ])("%s → %d", (t, n) => expect(parseRepeatCount(t)).toBe(n));
  it.each(["Ramp up in 4 steps", "Ramp down in 4 steps", "Repeat 1 time", undefined])("%s → none", (t) =>
    expect(parseRepeatCount(t)).toBeUndefined(),
  );
});
