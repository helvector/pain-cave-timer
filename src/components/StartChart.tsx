"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Block, Workout } from "@/lib/workout/types";
import { chartDensity, profileBars } from "@/lib/profile";
import { minutesLabel, positionLabel, wattsLabel, zoneLabel } from "@/lib/timer";
import { useSettings } from "./SettingsProvider";
import { MetricIcon } from "./MetricIcon";
import { WorkoutProfile } from "./WorkoutProfile";

/**
 * The start screen's chart, by how crowded the session is (`chartDensity`):
 *   roomy   a label on every bar (minutes inside, watts above).
 *   medium  "Scrub": clean bars; drag across the chart and one big readout follows.
 *   high    "Scale": clean bars; a faint line across the chart at each watt level, the
 *           watts written once in white on the line at the chart's right end (the last
 *           block is usually a low cool-down, so there's room), block lengths once underneath.
 * `force` overrides the choice (`?chart=scrub|scale`, for trying a style on any session).
 */
export type ChartStyle = "scrub" | "scale";

export function StartChart({ workout, force }: { workout: Workout; force?: ChartStyle }) {
  const density = chartDensity(workout.blocks, workout.totalSec);
  const style = force ?? (density === "high" ? "scale" : density === "medium" ? "scrub" : undefined);
  if (style === "scale") return <Scale workout={workout} />;
  if (style === "scrub") return <Scrub workout={workout} />;
  return <WorkoutProfile workout={workout} className="profile--hero" blockLabels />;
}

/* ---- Scrub --------------------------------------------------------------- */

function Scrub({ workout }: { workout: Workout }) {
  const total = Math.max(workout.totalSec, 1);
  const firstWork = workout.blocks.findIndex((b) => b.kind === "work");
  const [index, setIndex] = useState(firstWork >= 0 ? firstWork : 0);
  const [touched, setTouched] = useState(false);
  const block: Block = workout.blocks[Math.min(index, workout.blocks.length - 1)];
  const left = `${(block.startSec / total) * 100}%`;
  const width = `${(block.durationSec / total) * 100}%`;
  const watts = wattsLabel(block);

  const pick = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const t = Math.max(0, Math.min(0.9999, (e.clientX - r.left) / r.width)) * workout.totalSec;
    const i = workout.blocks.findIndex((b) => t < b.startSec + b.durationSec);
    setIndex(i < 0 ? workout.blocks.length - 1 : i);
    setTouched(true);
  };

  return (
    <div className="dense scrub">
      <div className="scrub__readout" aria-live="polite">
        <p className="scrub__big">
          <span><MetricIcon metric="timer" className="scrub__icon" />{minutesLabel(block.durationSec)}<small>min</small></span>
          {watts && <span><MetricIcon metric="power" className="scrub__icon" />{watts}<small>W</small></span>}
        </p>
        <p className="scrub__sub">
          <b>{block.index + 1}</b> of {workout.blocks.length} · {zoneLabel(block)}
          {block.set || block.part ? ` · ${positionLabel(block, workout.blocks.length)}` : ""}
        </p>
      </div>
      <div
        className="scrub__chart"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); pick(e); }}
        onPointerMove={(e) => { if (e.buttons || e.pointerType === "touch") pick(e); }}
      >
        <WorkoutProfile workout={workout} className="profile--hero profile--hero-scrub" />
        {/* Everything but the chosen bar steps back. */}
        <span className="scrub__dim" style={{ left: 0, width: left }} />
        <span className="scrub__dim" style={{ left: `calc(${left} + ${width})`, right: 0 }} />
        <span className="scrub__mark" style={{ left, width }} />
      </div>
      <p className="scrub__hint muted" aria-hidden>{touched ? " " : "Drag across the chart"}</p>
    </div>
  );
}

/* ---- Scale --------------------------------------------------------------- */

const SCALE_FS = 22;

function Scale({ workout }: { workout: Workout }) {
  const { zones } = useSettings();
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const bars = useMemo(() => profileBars(workout.blocks, undefined, zones), [workout.blocks, zones]);

  // Each distinct watt target once, at the height of its bars (top first).
  const kinds = new Map<string, { label: string; y: number }>();
  workout.blocks.forEach((b, i) => {
    const label = wattsLabel(b);
    if (label && !kinds.has(label)) kinds.set(label, { label, y: 1 - bars[i].height });
  });
  const rows = [...kinds.values()].sort((a, b) => a.y - b.y);
  const levels = [...new Set(rows.map((r) => r.y))];
  // Labels stand on their line (centre half a line above it); where two lines are closer than a
  // line of type, the labels spread apart.
  const step = SCALE_FS * 0.98;
  const pos = rows.map((r) => r.y * box.h - SCALE_FS * 0.52);
  if (pos.length) pos[0] = Math.max(pos[0], step / 2);
  for (let i = 1; i < pos.length; i++) pos[i] = Math.max(pos[i], pos[i - 1] + step);
  for (let i = pos.length - 1; i >= 0; i--) pos[i] = Math.min(pos[i], i === pos.length - 1 ? box.h - step / 2 : pos[i + 1] - step);

  // Each distinct block length once, drawn at its true width.
  const total = Math.max(workout.totalSec, 1);
  const lengths = [...new Map(workout.blocks.map((b) => [minutesLabel(b.durationSec), b.durationSec])).entries()].sort((a, b) => a[1] - b[1]);

  return (
    <div className="dense scale" style={{ "--fs": `${SCALE_FS}px` } as React.CSSProperties}>
      <div className="scale__chart" ref={ref}>
        <WorkoutProfile workout={workout} className="profile--hero" />
        {levels.map((y) => <span key={y} className="scale__line" style={{ top: `${y * 100}%` }} />)}
        <div className="scale__col" aria-hidden>
          {box.h > 0 && rows.map((r, i) => (
            <span key={r.label} className="scale__watts" style={{ top: `${pos[i]}px` }}>
              {i === 0 && <MetricIcon metric="power" className="scale__watts-icon" />}{r.label}
            </span>
          ))}
        </div>
      </div>
      <div className="scale__lengths" aria-hidden>
        <MetricIcon metric="timer" className="scale__icon" />
        {box.w > 0 && lengths.map(([label, sec]) => (
          <span key={label} className="scale__length">
            <i style={{ width: `${Math.max(3, (sec / total) * box.w)}px` }} />
            {label}
          </span>
        ))}
        <small>min</small>
      </div>
    </div>
  );
}
