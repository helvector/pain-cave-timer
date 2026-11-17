"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Workout } from "@/lib/workout/types";
import { hrPath, profileBars, shade, tint, UNRIDDEN_OPACITY, zoneColor, type HrSample, type PowerZone } from "@/lib/profile";
import type { PlayheadStyle } from "@/lib/settings";
import { minutesLabel, wattsLabel } from "@/lib/timer";
import { useSettings } from "./SettingsProvider";
import { MetricIcon } from "./MetricIcon";
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
  /** 0..1 from heart rate (resting → max): how hard the current block pulses and the line sparks. */
  intensity?: number;
  /** Write each block's duration (headline face, black, 80% of the bar's width) and wattage on its bar. */
  blockLabels?: boolean;
  className?: string;
}

/**
 * The session's shape: one bar per block, width = duration, height = target
 * watts, colour = power zone. Ridden time is drawn at full strength, the rest
 * dimmed; the current block pulses and a glowing line marks "now". SVG scaled with preserveAspectRatio="none"
 * so it fills any width; strokes keep their pixel width.
 */
export function WorkoutProfile({ workout, elapsedSec, currentIndex, ftp, hr, reservePx, zones: zonesProp, playhead, intensity = 0.25, blockLabels, className }: Props) {
  const saved = useSettings();
  const zoneSet = zonesProp ?? saved.zones;
  const style = playhead ?? saved.settings.playhead;
  const svgRef = useRef<HTMLDivElement>(null);
  const [heightPx, setHeightPx] = useState(0);
  const [widthPx, setWidthPx] = useState(0);
  useEffect(() => {
    const el = svgRef.current;
    if (!el || !(reservePx || blockLabels)) return;
    const ro = new ResizeObserver(([e]) => { setHeightPx(e.contentRect.height); setWidthPx(e.contentRect.width); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [reservePx, blockLabels]);
  // Fraction of the height where the chart's baseline sits (1 = bottom edge).
  const bleed = Boolean(reservePx && heightPx);
  const base = bleed ? Math.max(0.3, 1 - reservePx! / heightPx) : 1;
  const clipId = useId().replace(/:/g, "");
  const bars = useMemo(() => profileBars(workout.blocks, ftp, zoneSet), [workout.blocks, ftp, zoneSet]);
  const total = Math.max(workout.totalSec, 1);
  const gap = total * 0.0025;
  // Start screen: watts sit above each bar (power icon, then "100–140", or the two
  // numbers stacked when the bar is too narrow). Leave room for them over the tallest bars.
  const wattTags = useMemo(
    () => (blockLabels && widthPx > 0 && heightPx > 0
      ? bars.map((b) => wattTag(wattsLabel(workout.blocks[b.index]), ((b.width - gap) / total) * widthPx, heightPx * HEAD_MAX))
      : []),
    [blockLabels, widthPx, heightPx, bars, workout.blocks, gap, total],
  );
  const headPx = wattTags.reduce((m, t) => Math.max(m, t ? tagHeight(t) : 0), 0);
  const head = blockLabels && heightPx > 0 ? Math.min(HEAD_MAX, headPx / heightPx) : 0;
  /** Top of a bar of height h (0..1), as a fraction of the box; bars stand on topBase(). */
  const topOf = (h: number) => head + (base - head) * (1 - h);
  const topBase = () => (bleed ? base : 1);
  const ridden = elapsedSec === undefined ? undefined : Math.max(0, Math.min(total, elapsedSec));

  // One vertical gradient per zone: full colour at the top, 25% black at the base.
  const gradId = (zone: string) => `${clipId}-g-${zone}`;
  const zones = [...new Set(bars.map((b) => b.zone))];
  const rects = (opacity: number) =>
    bars.map((b) => (
      <rect
        key={b.index}
        x={b.x + gap / 2}
        y={topOf(b.height)}
        width={Math.max(b.width - gap, gap)}
        height={(bleed ? 1 : base) - topOf(b.height)}
        fill={`url(#${gradId(b.zone)})`}
        fillOpacity={opacity}
      />
    ));

  const cur = currentIndex !== undefined ? bars[currentIndex] : undefined;
  const { hrRest, hrMax } = saved.settings;
  const hrD = useMemo(() => (hr?.length ? hrPath(hr, { lo: hrRest, hi: hrMax }) : ""), [hr, hrRest, hrMax]);
  // Pulse: 2.6 s and soft at rest → 0.7 s and strong at max (quantised so the animation is not restarted every beat).
  const level = Math.round(Math.min(1, Math.max(0, intensity)) * 10) / 10;
  const pulseStyle = { "--pulse-dur": `${(2.6 - 1.9 * level).toFixed(2)}s`, "--pulse-peak": (0.35 + 0.5 * level).toFixed(2) } as React.CSSProperties;

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
          style={pulseStyle}
          x={cur.x + gap / 2}
          y={topOf(cur.height)}
          width={Math.max(cur.width - gap, gap)}
          height={(bleed ? 1 : base) - topOf(cur.height)}
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
    {blockLabels && widthPx > 0 && (
      <div className="profile__labels" aria-hidden>
        {bars.map((b) => {
          const block = workout.blocks[b.index];
          const t = minutesLabel(block.durationSec);
          // Balfron figures ≈ 0.29em wide (measured, with sidebearings), point ≈ 0.12em, "s" ≈ 0.22em.
          const em = t.replace(/[^0-9]/g, "").length * 0.29 + (t.includes(".") ? 0.12 : 0) + (t.endsWith("s") ? 0.22 : 0);
          const barW = ((b.width - gap) / total) * widthPx;
          const barH = (topBase() - topOf(b.height)) * heightPx;
          // The time spans up to 80% of the bar's width, as far as the bar's height allows; a bar too short
          // for even a small figure shows none. Timer icon above at half the figure height.
          const size = Math.min((LABEL_MAX * barW) / em, barH * 0.64);
          const left = `${((b.x + gap / 2) / total) * 100}%`;
          const width = `${((b.width - gap) / total) * 100}%`;
          const top = `${topOf(b.height) * 100}%`;
          const tag = wattTags[b.index];
          return (
            <div key={b.index}>
              {tag && (
                <div className={`profile__watts${tag.stacked ? " profile__watts--stacked" : ""}`} style={{ left, width, top, fontSize: `${tag.size}px` }}>
                  <MetricIcon metric="power" className="profile__watts-icon" />
                  {tag.lines.map((l) => <span key={l}>{l}</span>)}
                </div>
              )}
              {size >= 11 && (
                <div className="profile__label" style={{ left, width, top, "--fs": `${size}px` } as React.CSSProperties}>
                  {size * 0.338 >= 6 && <MetricIcon metric="timer" className="profile__label-icon" />}
                  <span className="profile__label-time">{t}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    )}
    {ridden !== undefined && (
      // The glowing "now" line with sparkles and vapour trailing off its left edge.
      <PlayheadFx
        x={ridden / total}
        top={cur ? topOf(cur.height) : 0}
        variant={style}
        color={cur ? cur.color : "#ffffff"}
        intensity={level}
      />
    )}
    </div>
  );
}

/** Labels span at most 80% and at least 30% of their bar's width. */
const LABEL_MAX = 0.8;
const LABEL_MIN = 0.3;
/** The watts above the bars may take up to this much of the chart's height. */
const HEAD_MAX = 0.3;
/** Smallest readable watts, px. */
const WATT_FLOOR = 11;

/** Watts above a bar: one line ("100–140") when it fits the bar, else the two numbers stacked. */
interface WattTag { lines: string[]; stacked: boolean; size: number }
/** Balfron: figures ≈ 0.28em, en dash ≈ 0.32em (measured). */
const wattEm = (s: string) => s.replace(/[^0-9]/g, "").length * 0.28 + (s.includes("–") ? 0.32 : 0);

/**
 * Sized with the bar: the text spans 80% of its width, capped by the room
 * above the bars (`budgetPx`), and never under 30% of the width. One line
 * when that fits; otherwise the numbers stack, which lets narrow bars keep
 * a readable size.
 */
function wattTag(label: string | undefined, barPx: number, budgetPx: number): WattTag | undefined {
  if (!label) return undefined;
  const fit = (lines: string[]) => {
    const em = Math.max(...lines.map(wattEm));
    const byHeight = (budgetPx - 6) / (0.95 + 0.9 * lines.length);
    const size = Math.min((LABEL_MAX * barPx) / em, byHeight);
    return { size, ok: size >= WATT_FLOOR && size >= Math.min((LABEL_MIN * barPx) / em, byHeight) };
  };
  const one = fit([label]);
  const parts = label.split("–");
  if (parts.length > 1) {
    const two = fit(parts);
    // Stack when one line would come out much smaller than the stacked numbers.
    if (two.ok && (!one.ok || two.size > one.size * 1.35)) return { lines: parts, stacked: true, size: two.size };
  }
  return one.ok ? { lines: [label], stacked: false, size: one.size } : undefined;
}

/** Height a tag needs above its bar: the power icon plus one line per number, plus a gap. */
function tagHeight(t: WattTag): number {
  return t.size * (0.95 + 0.9 * t.lines.length) + 6;
}
