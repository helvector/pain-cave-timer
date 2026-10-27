import { describe, expect, it } from "vitest";
import { parseCadence, parseDescriptionCadence, parseHeartRateTarget, parsePowerTarget } from "../src/lib/workout/target";

describe("parsePowerTarget", () => {
  it("absolute watts", () => {
    expect(parsePowerTarget("138-188 W")?.watts).toEqual({ lo: 138, hi: 188 });
    expect(parsePowerTarget("250w")?.watts).toEqual({ lo: 250, hi: 250 });
    expect(parsePowerTarget("3-135 W")?.watts).toEqual({ lo: 3, hi: 135 });
  });
  it("percent of FTP resolves when FTP given", () => {
    const t = parsePowerTarget("76-85% FTP", { ftp: 250 });
    expect(t?.ftpPct).toEqual({ lo: 76, hi: 85 });
    expect(t?.watts).toEqual({ lo: 190, hi: 213 });
    expect(parsePowerTarget("85%")?.watts).toBeUndefined();
  });
  it("zones", () => {
    const t = parsePowerTarget("Z4", { ftp: 200 });
    expect(t?.zone?.codes).toEqual(["Z4"]);
    expect(t?.watts).toEqual({ lo: 182, hi: 210 });
    expect(parsePowerTarget("sweet spot")?.zone?.codes).toEqual(["SS"]);
    expect(parsePowerTarget("Tempo-Threshold")?.zone?.codes).toEqual(["Z3", "Z4"]);
  });
  it("rejects heart rate", () => {
    expect(parsePowerTarget("140-150 bpm")).toBeUndefined();
  });
});

describe("parseCadence", () => {
  it("parses rpm", () => expect(parseCadence("80-95 rpm")).toEqual({ lo: 80, hi: 95 }));
});

describe("parseHeartRateTarget", () => {
  it("reads %THR from notes and resolves with a threshold", () => {
    const t = parseHeartRateTarget("RPE: 7-8 Heart Rate: 93-96% of THR", { thr: 160 });
    expect(t?.hrPctThr).toEqual({ lo: 93, hi: 96 });
    expect(t?.hrBpm).toEqual({ lo: 149, hi: 154 });
    expect(parseHeartRateTarget("Heart Rate: 84-92% of THR")?.hrBpm).toBeUndefined();
  });
  it("reads absolute bpm", () => {
    expect(parseHeartRateTarget("hr 140-150 bpm")?.hrBpm).toEqual({ lo: 140, hi: 150 });
  });
  it("ignores text without a heart-rate target", () => {
    expect(parseHeartRateTarget("Power: 88-94% of FTP")).toBeUndefined();
  });
});

describe("parseDescriptionCadence", () => {
  it("reads the Intensity Ranges line", () =>
    expect(parseDescriptionCadence("Intensity Ranges:\nRPE: 8-10\nHeart Rate: 93-100% of THR\nCadence: 80-100 RPM")).toEqual({ lo: 80, hi: 100 }));
  it("is undefined without one", () => {
    expect(parseDescriptionCadence("Ride easy.")).toBeUndefined();
    expect(parseDescriptionCadence(undefined)).toBeUndefined();
  });
});
