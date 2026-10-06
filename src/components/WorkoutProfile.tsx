"use client";

import { useId, useMemo } from "react";
import type { Workout } from "@/lib/workout/types";
import { hrPath, profileBars, shade, UNRIDDEN_OPACITY, ZONE_COLORS, type HrSample } from "@/lib/profile";

interface Props {
  workout: Workout;
  /** Seconds ridden so far; everything left of this is lit. Omit for an unridden preview. */
  elapsedSec?: number;
  /** Index of the block being ridden, drawn with an outline. */
  currentIndex?: number;
  ftp?: number;
  /** Heart-rate readings to draw as a red line over the bars. */
  hr?: HrSample[];
  className?: string;
}

/**
 * The session's shape: one bar per block, width = duration, height = target
 * watts, colour = power zone. Ridden time is drawn at full strength, the rest
 * dimmed, with a playhead at "now". SVG scaled with preserveAspectRatio="none"
 * so it fills any width; strokes keep their pixel width.
 */
export function WorkoutProfile({ workout, elapsedSec, currentIndex, ftp, hr, className }: Props) {
  const clipId = useId().replace(/:/g, "");
  const bars = useMemo(() => profileBars(workout.blocks, ftp), [workout.blocks, ftp]);
  const total = Math.max(workout.totalSec, 1);
  const gap = total * 0.0025;
  const ridden = elapsedSec === undefined ? undefined : Math.max(0, Math.min(total, elapsedSec));

  // One vertical gradient per zone: full colour at the top, 25% black at the base.
  const gradId = (zone: string) => `${clipId}-g-${zone}`;
  const zones = [...new Set(bars.map((b) => b.zone))];
  const rects = (opacity: number) =>
    bars.map((b) => (
      <rect
        key={b.index}
        x={b.x + gap / 2}
        y={1 - b.height}
        width={Math.max(b.width - gap, gap)}
        height={b.height}
        fill={`url(#${gradId(b.zone)})`}
        fillOpacity={opacity}
      />
    ));

  const cur = currentIndex !== undefined ? bars[currentIndex] : undefined;
  const hrD = useMemo(() => (hr?.length ? hrPath(hr) : ""), [hr]);

  return (
    <svg
      className={`profile ${className ?? ""}`}
      viewBox={`0 0 ${total} 1`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Workout profile, ${workout.blocks.length} blocks`}
    >
      <defs>
        {zones.map((z) => (
          <linearGradient key={z} id={gradId(z)} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={ZONE_COLORS[z]} />
            <stop offset="1" stopColor={shade(ZONE_COLORS[z], 0.25)} />
          </linearGradient>
        ))}
        {/*
          Black glow under the heart-rate line, blurred on the vertical axis
          only (stdDeviation x = 0) and with the filter region pinned to the
          line's own width, so its left and right ends stay clean.
          y blur is in chart units: 0.02 of the height ≈ 3 px on a phone.
        */}
        <filter id={`${clipId}-hr-glow`} x="0%" y="-60%" width="100%" height="220%">
          <feGaussianBlur stdDeviation="0 0.02" />
        </filter>
        {ridden !== undefined && (
          <clipPath id={clipId}>
            <rect x={0} y={0} width={ridden} height={1} />
          </clipPath>
        )}
      </defs>
      <g>{rects(ridden === undefined ? 0.85 : UNRIDDEN_OPACITY)}</g>
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
      {hrD && (
        <path
          className="profile__hr-glow"
          d={hrD}
          fill="none"
          stroke="#000"
          strokeOpacity={0.85}
          strokeWidth={5}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          filter={`url(#${clipId}-hr-glow)`}
        />
      )}
      {hrD && (
        <path
          className="profile__hr"
          d={hrD}
          fill="none"
          stroke="#ff2b2b"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {ridden !== undefined && ridden > 0 && ridden < total && (
        <line x1={ridden} x2={ridden} y1={0} y2={1} stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}
