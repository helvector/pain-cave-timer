import { describe, expect, it } from "vitest";
import { coachCues, isLastOfSet } from "../src/lib/timer";
import type { Block } from "../src/lib/workout/types";

const block = (over: Partial<Block>): Block => ({
  index: 0, kind: "work", title: "Active", durationSec: 900, startSec: 0, cue: "work",
  target: { raw: "15 min @ 220-235 W" }, ...over,
});

describe("coachCues", () => {
  it("reads cadence from the target and RPE / %THR from the notes", () => {
    const cues = coachCues(block({ target: { raw: "", cadenceRpm: { lo: 80, hi: 95 } }, notes: "RPE: 7-8 Heart Rate: 93-96% of THR" }));
    expect(cues).toEqual([
      { kind: "cadence", value: "80–95", unit: "rpm" },
      { kind: "rpe", value: "7–8", unit: "RPE" },
      { kind: "hr", value: "93–96", unit: "% THR" },
    ]);
  });

  it("prefers a resolved heart-rate target in bpm over the notes", () => {
    const cues = coachCues(block({ target: { raw: "", hrBpm: { lo: 150, hi: 156 } }, notes: "Heart Rate: 93-96% of THR" }));
    expect(cues).toEqual([{ kind: "cadence", value: "Open", unit: "rpm" }, { kind: "hr", value: "150–156", unit: "bpm" }]);
  });

  it("is just an Open cadence when the coach gave nothing extra", () => {
    expect(coachCues(block({}))).toEqual([{ kind: "cadence", value: "Open", unit: "rpm" }]);
  });
});

describe("isLastOfSet", () => {
  it("marks only the final work interval of a repeat", () => {
    expect(isLastOfSet(block({ set: { index: 3, count: 3 } }))).toBe(true);
    expect(isLastOfSet(block({ set: { index: 2, count: 3 } }))).toBe(false);
    expect(isLastOfSet(block({ kind: "recovery", set: { index: 3, count: 3 } }))).toBe(false);
  });
});
