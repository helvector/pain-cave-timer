"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { MetricIcon, type Metric } from "./MetricIcon";

/**
 * Opening splash ("Stamp", picked Nov 2026): the four metric icons pop in,
 * then PAIN, CAVE and TIMER slam down one by one with a small jolt as each
 * lands. About 2.7 s, played once per page load over whatever is loading
 * underneath. Left-aligned on the app's gutter. Skipped with reduced motion.
 */

const ICONS: Metric[] = ["cadence", "heart", "power", "timer"];
const WORDS = ["PAIN", "CAVE", "TIMER"];
/** Balfron's left sidebearing of each word's first letter (P, C, T), in em: pulled back so the ink starts on the gutter with the icons. */
const INK_LEFT: Record<string, number> = { PAIN: 0.032, CAVE: 0.024, TIMER: 0.016 };
/** When the overlay starts fading, and when it is gone (ms). */
const EXIT_AT = 2300;
const DONE_AT = 2700;

export function Splash({ onDone }: { onDone: () => void }) {
  const [exiting, setExiting] = useState(false);
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduce) {
      const id = setTimeout(onDone, 0);
      return () => clearTimeout(id);
    }
    const a = setTimeout(() => setExiting(true), EXIT_AT);
    const b = setTimeout(onDone, DONE_AT);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [onDone]);

  return (
    <motion.div
      className="splash"
      role="img"
      aria-label="Pain Cave Timer"
      initial={{ opacity: 1 }}
      animate={exiting ? { opacity: 0, scale: 1.04 } : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeIn" }}
    >
      <Stamp />
    </motion.div>
  );
}

const SLAM_START = 0.75; // s
const SLAM_STEP = 0.2;
const SLAM_DUR = 0.22;

function Stamp() {
  // The stage jolts each time a word lands.
  const total = 1.9;
  const lands = WORDS.map((_, i) => SLAM_START + i * SLAM_STEP + SLAM_DUR);
  const times: number[] = [0];
  const y: number[] = [0];
  for (const [i, t] of lands.entries()) {
    const k = 7 + i * 2;
    times.push(t / total, (t + 0.05) / total, (t + 0.12) / total);
    y.push(0, k, -k * 0.35);
  }
  times.push(1);
  y.push(0);

  return (
    <motion.div className="splash__stage" animate={{ y }} transition={{ duration: total, times, ease: "easeOut" }}>
      <div className="splash__icons">
        {ICONS.map((m, i) => (
          <motion.span
            key={m}
            className="splash__icon"
            initial={{ scale: 2.6, opacity: 0, rotate: -12 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 22, delay: 0.1 + i * 0.12 }}
          >
            <MetricIcon metric={m} size="large" />
          </motion.span>
        ))}
      </div>
      <div className="splash__words">
        {WORDS.map((w, i) => (
          <motion.span
            key={w}
            className="splash__word"
            style={{ marginLeft: `-${INK_LEFT[w]}em` }}
            initial={{ scale: 2.2, opacity: 0, filter: "blur(10px)" }}
            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: SLAM_DUR, ease: [0.55, 0, 1, 0.45], delay: SLAM_START + i * SLAM_STEP }}
          >
            {w}
          </motion.span>
        ))}
      </div>
    </motion.div>
  );
}
