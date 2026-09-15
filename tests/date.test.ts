import { describe, expect, it } from "vitest";
import { appTimeZone, todayIn } from "../src/lib/date";

describe("todayIn", () => {
  it("respects the zone across midnight UTC", () => {
    const t = new Date("2026-09-16T03:00:00Z");
    expect(todayIn("America/Los_Angeles", t)).toBe("2026-09-15");
    expect(todayIn("Europe/London", t)).toBe("2026-09-16");
  });
  it("defaults the app zone", () => {
    expect(appTimeZone({})).toBe("America/Los_Angeles");
    expect(appTimeZone({ APP_TIMEZONE: "Europe/Paris" })).toBe("Europe/Paris");
  });
});
