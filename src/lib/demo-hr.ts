import type { Workout } from "./workout/types";
import type { HrSample } from "./profile";

/**
 * Demo only: a plausible heart-rate trace for a workout up to `untilSec`, so
 * previews of the end-of-ride image show real-looking lines and min/max.
 * Heart rate chases each block's intensity with a ~55 s lag, plus wobble.
 */
export function syntheticHr(workout: Workout, untilSec: number, rest = 80, max = 196): HrSample[] {
  const top = Math.max(...workout.blocks.map((b) => b.target.watts?.hi ?? 0), 1);
  const out: HrSample[] = [];
  let hr = rest + 14;
  for (let t = 0; t <= untilSec; t += 2) {
    const b = workout.blocks.find((x) => t >= x.startSec && t < x.startSec + x.durationSec) ?? workout.blocks[workout.blocks.length - 1];
    const load = (b.target.watts?.hi ?? 0) / top;
    const target = rest + 18 + load * (max - rest - 30);
    hr += (target - hr) * (1 - Math.exp(-2 / 55));
    out.push({ t, bpm: Math.round(hr + 1.8 * Math.sin(t / 37) + 1.2 * Math.sin(t / 11)) });
  }
  return out;
}
