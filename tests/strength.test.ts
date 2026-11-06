import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseTrainingPeaksEmail } from "../src/lib/workout";
import { demoWorkouts } from "../src/lib/workout/demo";

const html = readFileSync("fixtures/trainingpeaks-2026-10-22.html", "utf8");
const subject = "Schedule for Thursday 10/22/2026 to Friday 10/23/2026";

describe("gym sessions (Structured Strength)", () => {
  const { days } = parseTrainingPeaksEmail(html, { subject });
  const [ride, gym] = days;

  it("reads a gym-only day as a gym session, not an empty ride", () => {
    expect(gym.date).toBe("2026-10-23");
    expect(gym.title).toBe("Cycling Specific Weight Work");
    expect(gym.blocks).toEqual([]);
    expect(gym.warnings).toEqual([]);
    expect(gym.strength).toHaveLength(1);
    expect(gym.strength![0]).toMatchObject({ title: "Cycling Specific Weight Work", sets: 20, exercises: 8 });
  });

  it("keeps the coach's notes as paragraphs", () => {
    const notes = gym.strength![0].notes;
    expect(notes).toHaveLength(3);
    expect(notes[0]).toMatch(/^Should be performed 2-3 times per week/);
    expect(notes[2]).toMatch(/adding reps & maintaining fluidity & form rather than adding weight\.$/);
  });

  it("leaves ride days alone", () => {
    expect(ride.title).toMatch(/Sweet Spot Tempo/);
    expect(ride.blocks).toHaveLength(5);
    expect(ride.strength).toBeUndefined();
  });

  it("keeps the ride's title when gym work is on the same day", () => {
    // Move the gym section into Thursday's (empty) Structured Strength slot.
    const section = html.match(/<!-- Structured Strength: START -->([\s\S]*?)<!-- Structured Strength: END -->/g)!;
    const filled = section.find((x) => /workoutTag/.test(x))!;
    const empty = section.find((x) => !/workoutTag/.test(x))!;
    const both = html.replace(filled, "<!-- Structured Strength: START --> <!-- Structured Strength: END -->").replace(empty, filled);
    const [thu, fri] = parseTrainingPeaksEmail(both, { subject }).days;
    expect(thu.title).toMatch(/Sweet Spot Tempo/);
    expect(thu.blocks).toHaveLength(5);
    expect(thu.strength?.[0].title).toBe("Cycling Specific Weight Work");
    expect(fri.strength).toBeUndefined();
  });

  it("is available as a demo", () => {
    const [today, tomorrow] = demoWorkouts("2026-11-06", { fixture: "gym" });
    expect(today.blocks.length).toBeGreaterThan(0);
    expect(tomorrow.strength?.[0].sets).toBe(20);
  });
});
