import { describe, expect, it } from "vitest";
import { formatClock, parseDuration } from "../src/lib/workout/duration";

describe("parseDuration", () => {
  it.each([
    ["20 min", 1200],
    ["1 hr 30 min", 5400],
    ["1hr30min", 5400],
    ["4.00 hrs", 14400],
    ["45 sec", 45],
    ["90s", 90],
    ["10m", 600],
    ["1:30", 90],
    ["1:30:00", 5400],
    ["10'", 600],
    ['30"', 30],
    ["2 hours", 7200],
  ])("%s → %d", (text, sec) => expect(parseDuration(text)).toBe(sec));

  it("rejects non-durations", () => {
    expect(parseDuration("Warm up")).toBeUndefined();
    expect(parseDuration("10 min @ 200 W")).toBeUndefined();
    expect(parseDuration("")).toBeUndefined();
  });
});

describe("formatClock", () => {
  it("formats", () => {
    expect(formatClock(90)).toBe("1:30");
    expect(formatClock(5400)).toBe("1:30:00");
  });
});
