"use client";

import type { BlockKind } from "@/lib/workout/types";
import { BubbleBackground, type BubbleColors } from "@/components/animate-ui/components/backgrounds/bubble";

/**
 * Blob palettes per block kind, as "r,g,b" strings. They sit on the deep
 * base tint at reduced opacity so white numerals stay readable at 3 m.
 */
const PALETTES: Record<BlockKind, BubbleColors> = {
  work: { first: "255,90,54", second: "255,40,90", third: "255,140,0", fourth: "140,20,10", fifth: "220,60,40" },
  recovery: { first: "63,169,245", second: "20,90,200", third: "0,200,220", fourth: "10,40,110", fifth: "80,120,255" },
  warmup: { first: "150,150,165", second: "90,90,115", third: "120,140,160", fourth: "60,60,75", fifth: "110,110,130" },
  cooldown: { first: "120,140,165", second: "70,90,120", third: "100,130,160", fourth: "40,55,75", fifth: "90,110,140" },
};

/** Resting breath when no strap is connected, in beats per minute. */
const IDLE_BPM = 12;

interface Props {
  kind: BlockKind;
  /** Live heart rate; the whole field pulses once per beat. */
  bpm?: number;
}

/**
 * The ride screen's living background: Animate UI bubbles coloured by the
 * block's intensity and pulsed at the rider's heart rate. Pulse is a CSS
 * animation whose period is 60 / bpm, so a changing BPM just re-times the
 * loop instead of restarting it. Reduced-motion users get the static tint.
 */
export function RideBackground({ kind, bpm }: Props) {
  const beats = bpm && bpm > 30 ? Math.round(bpm / 2) * 2 : IDLE_BPM;
  return (
    <div className="ride-bg" aria-hidden style={{ "--beat": `${(60 / beats).toFixed(3)}s` } as React.CSSProperties}>
      <BubbleBackground colors={PALETTES[kind]} className={`ride-bg__bubbles ride-bg__bubbles--${kind}`} />
    </div>
  );
}
