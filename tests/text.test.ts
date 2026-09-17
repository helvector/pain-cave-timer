import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseStepLine, parseWorkoutFromText } from "../src/lib/workout";

describe("parseStepLine", () => {
  it("TrainingPeaks joined form", () => {
    const { step, leftovers } = parseStepLine("15 min @ 220-235 W - Tempo-Threshold - 80-95 rpm - Notes - RPE 7-8", {}, "Active");
    expect(leftovers).toEqual([]);
    expect(step?.durationSec).toBe(900);
    expect(step?.target.watts).toEqual({ lo: 220, hi: 235 });
    expect(step?.target.zone?.codes).toEqual(["Z3", "Z4"]);
    expect(step?.target.cadenceRpm).toEqual({ lo: 80, hi: 95 });
    expect(step?.notes).toBe("RPE 7-8");
  });
  it("title in front, no @", () => {
    const { step } = parseStepLine("Warm up 10 min Z2");
    expect(step?.title).toBe("Warm up");
    expect(step?.target.zone?.codes).toEqual(["Z2"]);
  });
  it("on/off shorthand", () => {
    expect(parseStepLine("1 min on").step?.title).toBe("on");
    expect(parseStepLine("1 min off").step?.title).toBe("off");
  });
  it("takes a heart-rate step as its own target", () => {
    const { step, leftovers } = parseStepLine("5 min @ 140-150 bpm");
    expect(step?.durationSec).toBe(300);
    expect(step?.target.hrBpm).toEqual({ lo: 140, hi: 150 });
    expect(leftovers).toEqual([]);
    expect(parseStepLine("Just ride").step).toBeUndefined();
  });
});

describe("parseWorkoutFromText", () => {
  it("expands indented repeats at parse time", () => {
    const w = parseWorkoutFromText(readFileSync("fixtures/coach-text-repeats.txt", "utf8"), { ftp: 200 });
    expect(w.unparsed).toEqual([]);
    expect(w.blocks.map((b) => `${b.kind}:${b.durationSec}`)).toEqual([
      "warmup:600", "work:300", "recovery:300", "work:300", "recovery:300", "work:300", "recovery:300", "cooldown:600",
    ]);
    expect(w.blocks.map((b) => (b.set ? `${b.set.index}/${b.set.count}` : ""))).toEqual(["", "1/3", "1/3", "2/3", "2/3", "3/3", "3/3", ""]);
    expect(w.blocks[1].target.watts).toEqual({ lo: 182, hi: 210 });
    expect(w.blocks[0].target.watts).toEqual({ lo: 110, hi: 140 });
    expect(w.totalSec).toBe(3000);
    expect(w.warnings).toEqual([]);
  });

  it("expands inline repeats and on/off", () => {
    const w = parseWorkoutFromText(readFileSync("fixtures/coach-text-inline.txt", "utf8"), { ftp: 250 });
    expect(w.blocks.map((b) => `${b.kind}:${b.durationSec}`)).toEqual([
      "recovery:900",
      "work:30", "recovery:30", "work:30", "recovery:30", "work:30", "recovery:30", "work:30", "recovery:30",
      "recovery:300",
      "work:60", "recovery:60", "work:60", "recovery:60",
      "recovery:600",
    ]);
    // "1 min on" has no power target: flagged, not dropped.
    expect(w.warnings.some((m) => /no watt target/.test(m))).toBe(true);
  });

  it("numbered plain-text form from the email", () => {
    const w = parseWorkoutFromText(`
   1.

   1

   Warm up
   10 min @ 138-188 W - Recovery-Endurance

   2.

   2

   Active
   15 min @ 190-213 W - Tempo - 80-95 rpm
   Notes - RPE: 6-7 Heart Rate: 84-92% of THR
`);
    expect(w.blocks.map((b) => b.title)).toEqual(["Warm up", "Active"]);
    expect(w.blocks[1].notes).toMatch(/^RPE: 6-7/);
    expect(w.unparsed).toEqual([]);
  });
});
