import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseTrainingPeaksEmail } from "../src/lib/workout";
import { hrStats } from "../src/lib/summary-card";
import { syntheticHr } from "../src/lib/demo-hr";

const ss = parseTrainingPeaksEmail(readFileSync("fixtures/trainingpeaks-steadystate-4x8.html", "utf8"), {
  subject: "Schedule for Tuesday 10/13/2026 to Wednesday 10/14/2026",
}).days[0];

describe("hrStats", () => {
  it("finds min and max with their times, ignoring dropouts", () => {
    expect(hrStats([{ t: 0, bpm: 120 }, { t: 2, bpm: null }, { t: 4, bpm: 96 }, { t: 6, bpm: 171 }])).toEqual({ min: 96, max: 171, minT: 4, maxT: 6 });
  });
  it("is undefined with no readings, so the image omits the red numbers", () => {
    expect(hrStats([])).toBeUndefined();
    expect(hrStats([{ t: 0, bpm: null }])).toBeUndefined();
  });
});

describe("syntheticHr (demo)", () => {
  it("covers the ride every 2 s and stays inside resting..max", () => {
    const hr = syntheticHr(ss, ss.totalSec);
    expect(hr).toHaveLength(ss.totalSec / 2 + 1);
    const s = hrStats(hr)!;
    expect(s.min).toBeGreaterThanOrEqual(80);
    expect(s.max).toBeLessThanOrEqual(196);
    expect(s.max).toBeGreaterThan(s.min + 30);
  });
});
