"use client";

import { useId, useMemo } from "react";
import type { Workout } from "@/lib/workout/types";
import { profileBars } from "@/lib/profile";

interface Props {
  workout: Workout;
  /** Seconds ridden so far; everything left of this is lit. Omit for an unridden preview. */
  elapsedSec?: number;
  /** Index of the block being ridden, drawn with an outline. */
  currentIndex?: number;
  ftp?: number;
  className?: string;
}

/**
 * The session's shape: one bar per block, width = duration, height = target
 * watts, colour = power zone. Ridden time is drawn at full strength, the rest
 * dimmed, with a playhead at "now". SVG scaled with preserveAspectRatio="none"
 * so it fills any width; strokes keep their pixel width.
 */
export function WorkoutProfile({ workout, elapsedSec, currentIndex, ftp, className }: Props) {
  const clipId = useId().replace(/:/g, "");
  const bars = useMemo(() => profileBars(workout.blocks, ftp), [workout.blocks, ftp]);
  const total = Math.max(workout.totalSec, 1);
  const gap = total * 0.0025;
  const ridden = elapsedSec === undefined ? undefined : Math.max(0, Math.min(total, elapsedSec));

  const rects = (opacity: number) =>
    bars.map((b) => (
      <rect
        key={b.index}
        x={b.x + gap / 2}
        y={1 - b.height}
        width={Math.max(b.width - gap, gap)}
        height={b.height}
        fill={b.color}
        fillOpacity={opacity}
      />
    ));

  const cur = currentIndex !== undefined ? bars[currentIndex] : undefined;

  return (
    <svg
      className={`profile ${className ?? ""}`}
      viewBox={`0 0 ${total} 1`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Workout profile, ${workout.blocks.length} blocks`}
    >
      {ridden !== undefined && (
        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={ridden} height={1} />
          </clipPath>
        </defs>
      )}
      <g>{rects(ridden === undefined ? 0.85 : 0.22)}</g>
      {ridden !== undefined && <g clipPath={`url(#${clipId})`}>{rects(1)}</g>}
      {cur && (
        <rect
          x={cur.x + gap / 2}
          y={1 - cur.height}
          width={Math.max(cur.width - gap, gap)}
          height={cur.height}
          fill="none"
          stroke="#fff"
          strokeOpacity={0.9}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {ridden !== undefined && ridden > 0 && ridden < total && (
        <line x1={ridden} x2={ridden} y1={0} y2={1} stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}
