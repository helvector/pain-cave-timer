import { describe, expect, it } from "vitest";
import { demoWorkouts } from "../src/lib/workout/demo";

describe("design review demo", () => {
  const days = demoWorkouts("2026-11-01", { fixture: "review" });

  it("has ten ride days, one per date from today", () => {
    expect(days).toHaveLength(10);
    expect(days.map((d) => d.date)).toEqual(Array.from({ length: 10 }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`));
    expect(days.every((d) => !d.isRestDay && d.blocks.length > 0)).toBe(true);
  });

  it("parses every session cleanly", () => {
    for (const d of days) {
      expect(d.unparsed, d.title).toEqual([]);
      expect(d.warnings, d.title).toEqual([]);
    }
  });

  it("covers the sessions picked for review", () => {
    expect(days.map((d) => d.title.replace(" (demo)", ""))).toEqual([
      "EM w/Steady State Intervals 4x8min (4min RBI)",
      "Sweet Spot Tempo 2x25min (5min RBI)",
      "Endurance Mile Steps at self-selected cadence.",
      "Endurance Miles 3.50hrs",
      "Sweet Spot Tempo 1x40min",
      "Endurance Power Ladders at self-selected cadence",
      "Aerobic OverUnder 3x16 (4U / 4O / 4U / 4O) - 8 min RBI",
      "Aerobic OverUnder 3x12 (4U / 2O / 4U / 2O) - 6min RBI",
      "Recovery Miles 1.00hrs",
      "EM w/Aerobic Tempo 3x15min (5min RBI)",
    ]);
  });
});
