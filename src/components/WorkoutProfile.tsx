"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Workout } from "@/lib/workout/types";
import { hrPath, profileBars, shade, tint, UNRIDDEN_OPACITY, zoneColor, type HrSample, type PowerZone } from "@/lib/profile";
import type { PlayheadStyle } from "@/lib/settings";
import { useSettings } from "./SettingsProvider";
import { PlayheadFx } from "./PlayheadFx";

interface Props {
  workout: Workout;
  /** Seconds ridden so far; everything left of this is lit. Omit for an unridden preview. */
  elapsedSec?: number;
  /** Index of the block being ridden; it gently pulses. */
  currentIndex?: number;
  ftp?: number;
  /** Heart-rate readings to draw as a red line over the bars. */
  hr?: HrSample[];
  /**
   * Pixels at the bottom reserved for overlaid controls. Bar tops, the
   * heart-rate line and the playhead live above this band; the bars
   * themselves keep drawing down through it to the bottom edge.
   */
  reservePx?: number;
  /** Override the saved zones (the admin page previews unsaved edits). */
  zones?: PowerZone[];
  /** Override the saved "now" line style. */
  playhead?: PlayheadStyle;
  className?: string;
}

/**
 * The session's shape: one bar per block, width = duration, height = target
 * watts, colour = power zone. Ridden time is drawn at full strength, the rest
 * dimmed; the current block pulses and a glowing line marks "now". SVG scaled with preserveAspectRatio="none"
 * so it fills any width; strokes keep their pixel width.
 */
export function WorkoutProfile({ workout, elapsedSec, currentIndex, ftp, hr, reservePx, zones: zonesProp, playhead, className }: Props) {
  const saved = useSettings();
  const zoneSet = zonesProp ?? saved.zones;
  const style = playhead ?? saved.settings.playhead;
  const svgRef = useRef<HTMLDivElement>(null);
  const [heightPx, setHeightPx] = useState(0);
  useEffect(() => {
    const el = svgRef.current;
    if (!el || !reservePx) return;
    const ro = new ResizeObserver(([e]) => setHeightPx(e.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [reservePx]);
  // Fraction of the height where the chart's baseline sits (1 = bottom edge).
  const bleed = Boolean(reservePx && heightPx);
  const base = bleed ? Math.max(0.3, 1 - reservePx! / heightPx) : 1;
  const clipId = useId().replace(/:/g, "");
  const bars = useMemo(() => profileBars(workout.blocks, ftp, zoneSet), [workout.blocks, ftp, zoneSet]);
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
        y={base * (1 - b.height)}
        width={Math.max(b.width - gap, gap)}
        height={(bleed ? 1 : base) - base * (1 - b.height)}
        fill={`url(#${gradId(b.zone)})`}
        fillOpacity={opacity}
      />
    ));

  const cur = currentIndex !== undefined ? bars[currentIndex] : undefined;
  const hrD = useMemo(() => (hr?.length ? hrPath(hr) : ""), [hr]);

  return (
    <div ref={svgRef} className={`profile ${className ?? ""}`}>
    <svg
      className="profile__svg"
      viewBox={`0 0 ${total} 1`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Workout profile, ${workout.blocks.length} blocks`}
    >
      <defs>
        {zones.map((z) => (
          <linearGradient key={z} id={gradId(z)} x1="0" y1="0" x2="0" y2="1">
            {/*
              Glossy cap: a lighter top edge easing into full colour, held
              through the middle, then down to 25% black at 50% opacity.
            */}
            <stop offset="0" stopColor={tint(zoneColor(z, zoneSet), 0.45)} />
            <stop offset="0.07" stopColor={tint(zoneColor(z, zoneSet), 0.12)} />
            <stop offset="0.22" stopColor={zoneColor(z, zoneSet)} />
            <stop offset="0.55" stopColor={zoneColor(z, zoneSet)} />
            <stop offset="1" stopColor={shade(zoneColor(z, zoneSet), 0.25)} stopOpacity={0.5} />
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
        // The block being ridden breathes gently instead of wearing an outline.
        <rect
          className="profile__pulse"
          x={cur.x + gap / 2}
          y={base * (1 - cur.height)}
          width={Math.max(cur.width - gap, gap)}
          height={(bleed ? 1 : base) - base * (1 - cur.height)}
          fill={`url(#${gradId(cur.zone)})`}
        />
      )}
      <g transform={`scale(1 ${base})`}>
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
      </g>
    </svg>
    {ridden !== undefined && (
      // The glowing "now" line with sparkles and vapour trailing off its left edge.
      <PlayheadFx x={ridden / total} band={base} variant={style} color={cur ? cur.color : "#ffffff"} />
    )}
    </div>
  );
}
