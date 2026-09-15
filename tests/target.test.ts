import { describe, expect, it } from "vitest";
import { parseCadence, parsePowerTarget } from "../src/lib/workout/target";

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
