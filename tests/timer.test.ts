import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseTrainingPeaksEmail } from "../src/lib/workout";
import { clock, positionAt, wattsLabel, zoneLabel } from "../src/lib/timer";

const html = readFileSync("fixtures/trainingpeaks-sweet-spot-3x15.html", "utf8");
const w = parseTrainingPeaksEmail(html, { subject: "Schedule for Thursday 09/10/2026 to Friday 09/11/2026" }).days[0];

describe("positionAt", () => {
  it("starts in the first block with full time remaining", () => {
    const p = positionAt(w, 0);
    expect(p.index).toBe(0);
    expect(p.remainingSec).toBe(1200);
    expect(p.next?.title).toBe("Active");
  });
  it("rounds remaining up so the display never shows 0 early", () => {
    expect(positionAt(w, 1199.2).remainingSec).toBe(1);
    expect(positionAt(w, 1199.95).remainingSec).toBe(1);
  });
  it("moves to the next block exactly at the boundary", () => {
    const p = positionAt(w, 1200);
    expect(p.index).toBe(1);
    expect(p.remainingSec).toBe(900);
    expect(p.block.cue).toBe("work");
  });
  it("finishes at the total", () => {
    expect(positionAt(w, 5399.5).finished).toBe(false);
    const p = positionAt(w, 5400);
    expect(p.finished).toBe(true);
    expect(p.remainingSec).toBe(0);
    expect(p.index).toBe(6);
  });
  it("tolerates negative elapsed", () => {
    expect(positionAt(w, -5).index).toBe(0);
  });
});

describe("labels", () => {
  it("formats", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(59.6)).toBe("1:00");
    expect(clock(3661)).toBe("1:01:01");
    expect(wattsLabel(w.blocks[1])).toBe("220–235");
    expect(zoneLabel(w.blocks[1])).toBe("Tempo · Threshold");
    expect(zoneLabel({ ...w.blocks[0], target: { raw: "" } })).toBe("Warm up");
  });
});
