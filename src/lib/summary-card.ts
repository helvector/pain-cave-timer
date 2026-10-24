import type { Workout } from "./workout/types";
import type { HrSample, PowerZone } from "./profile";
import { profileBars } from "./profile";
import { formatClock } from "./workout/duration";

/**
 * End-of-ride share image, drawn straight onto a canvas (no DOM capture, so it
 * renders the same in Safari, Bluefy and Chrome). Two layouts: a 4:5 data card
 * and a 9:16 story.
 * Every layout shows the workout profile with each block's planned peak watts
 * on top of its bar at 20% transparency, the heart-rate line, and the ride's
 * min and max heart rate in red.
 */

export const SUMMARY_VARIANTS = ["data", "story"] as const;
export type SummaryVariant = (typeof SUMMARY_VARIANTS)[number];

export const SUMMARY_LABELS: Record<SummaryVariant, { name: string; size: string }> = {
  data: { name: "Data card", size: "1080 × 1350" },
  story: { name: "Story", size: "1080 × 1920" },
};

export interface SummaryInput {
  workout: Workout;
  hr: HrSample[];
  zones: PowerZone[];
  hrRest: number;
  hrMax: number;
  /** CSS font-family strings, e.g. read from --font-display / --font-ui. */
  display: string;
  ui: string;
}

const HR_RED = "#ff2b2b";
/** 20% transparency for the planned-peak labels. */
const PEAK_ALPHA = 0.8;

export function hrStats(hr: HrSample[]): { min: number; max: number; minT: number; maxT: number } | undefined {
  const live = hr.filter((s): s is { t: number; bpm: number } => s.bpm !== null);
  if (!live.length) return undefined;
  let min = live[0], max = live[0];
  for (const s of live) { if (s.bpm < min.bpm) min = s; if (s.bpm > max.bpm) max = s; }
  return { min: min.bpm, max: max.bpm, minT: min.t, maxT: max.t };
}

function niceDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (s: number) => Math.round(((n >> s) & 255) * (1 - k));
  return `rgb(${c(16)}, ${c(8)}, ${c(0)})`;
}
function tint(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (s: number) => Math.round(((n >> s) & 255) + (255 - ((n >> s) & 255)) * k);
  return `rgb(${c(16)}, ${c(8)}, ${c(0)})`;
}

interface Box { x: number; y: number; w: number; h: number }

/**
 * The profile: bars (zone gradient, as in the app), planned peak labels, HR
 * line with min/max markers. `fill` bleeds bars to the box bottom.
 */
function drawProfile(ctx: CanvasRenderingContext2D, box: Box, input: SummaryInput, opts: { labelSize: number; hrWidth: number; showMarkers?: boolean }) {
  const { workout, zones } = input;
  const bars = profileBars(workout.blocks, undefined, zones);
  const total = Math.max(workout.totalSec, 1);
  const sx = (sec: number) => box.x + (sec / total) * box.w;
  const gap = Math.max(2, box.w * 0.004);
  // Bars live in the top 86% of the box; peak labels need room above the tallest.
  const band = box.h * 0.86, top0 = box.y + box.h * 0.14;

  bars.forEach((b) => {
    const x = sx(b.x) + gap / 2, w = Math.max(sx(b.x + b.width) - sx(b.x) - gap, 1);
    const y = top0 + band * (1 - b.height), h = box.y + box.h - y;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, tint(b.color, 0.45));
    g.addColorStop(0.07, tint(b.color, 0.12));
    g.addColorStop(0.22, b.color);
    g.addColorStop(0.6, b.color);
    g.addColorStop(1, shade(b.color, 0.55));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  });

  // Planned peak watts on top of each bar, 20% transparent; skipped where the bar is too narrow to hold the number.
  ctx.save();
  ctx.font = `${opts.labelSize}px ${input.display}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = `rgba(255, 255, 255, ${PEAK_ALPHA})`;
  bars.forEach((b, i) => {
    const peak = workout.blocks[i].target.watts?.hi;
    if (!peak) return;
    const x0 = sx(b.x), x1 = sx(b.x + b.width);
    const label = String(peak);
    if (ctx.measureText(label).width > x1 - x0 - gap) return;
    ctx.fillText(label, (x0 + x1) / 2, top0 + band * (1 - b.height) - opts.labelSize * 0.25);
  });
  ctx.restore();

  // Heart-rate line on the resting → max scale, over the bars.
  const live = input.hr.filter((s) => s.bpm !== null) as { t: number; bpm: number }[];
  if (live.length > 1) {
    const yOf = (bpm: number) => top0 + band * (1 - Math.min(1, Math.max(0, (bpm - input.hrRest) / (input.hrMax - input.hrRest))) * 0.92);
    const path = new Path2D();
    let pen = false, lastT = -Infinity;
    for (const s of input.hr) {
      if (s.bpm === null || s.t - lastT > 6 || s.t < lastT) pen = false;
      if (s.bpm !== null) { if (pen) path.lineTo(sx(s.t), yOf(s.bpm)); else path.moveTo(sx(s.t), yOf(s.bpm)); pen = true; }
      lastT = s.t;
    }
    ctx.save();
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(0,0,0,0.75)"; ctx.lineWidth = opts.hrWidth * 3; ctx.filter = `blur(${opts.hrWidth}px)`; ctx.stroke(path);
    ctx.filter = "none"; ctx.strokeStyle = HR_RED; ctx.lineWidth = opts.hrWidth; ctx.stroke(path);
    const stats = hrStats(input.hr);
    if (stats && opts.showMarkers !== false) {
      for (const [t, bpm] of [[stats.maxT, stats.max], [stats.minT, stats.min]] as const) {
        ctx.beginPath(); ctx.arc(sx(t), yOf(bpm), opts.hrWidth * 2.6, 0, Math.PI * 2);
        ctx.fillStyle = HR_RED; ctx.fill(); ctx.lineWidth = opts.hrWidth; ctx.strokeStyle = "#000"; ctx.stroke();
      }
    }
    ctx.restore();
  }
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, fill: string) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 24, s / 24); ctx.fillStyle = fill;
  ctx.fill(new Path2D("M12 21.6 10.3 20C4.2 14.5 0 10.7 0 6.1 0 2.6 2.7 0 6.2 0c2 0 3.9.9 5.8 2.8C13.9.9 15.8 0 17.8 0 21.3 0 24 2.6 24 6.1c0 4.6-4.2 8.4-10.3 13.9L12 21.6Z"));
  ctx.restore();
}

function backdrop(ctx: CanvasRenderingContext2D, W: number, H: number, glow: string) {
  ctx.fillStyle = "#08080a"; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W * 0.5, H * 0.35, 0, W * 0.5, H * 0.35, Math.max(W, H) * 0.7);
  g.addColorStop(0, glow.replace("rgb", "rgba").replace(")", ", 0.28)"));
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

/** Wrap text into lines that fit maxWidth (titles can be long: "Sweet Spot Tempo 2x25min (5min RBI)"). */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/); const lines: string[] = []; let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function hardestColor(input: SummaryInput): string {
  const bars = profileBars(input.workout.blocks, undefined, input.zones);
  const top = bars.reduce((a, b) => (b.height > a.height ? b : a), bars[0]);
  const n = parseInt((top?.color ?? "#ff6a1a").slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

/** Data card: the profile bleeds edge to edge, a stats grid below with heart rate in red. */
function data(ctx: CanvasRenderingContext2D, W: number, H: number, input: SummaryInput) {
  const { workout } = input; const P = 64;
  ctx.fillStyle = "#050506"; ctx.fillRect(0, 0, W, H);
  const chartH = 700;
  const g = ctx.createLinearGradient(0, 0, 0, chartH);
  g.addColorStop(0, "#14141a"); g.addColorStop(1, "#050506");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, chartH);
  drawProfile(ctx, { x: 0, y: 40, w: W, h: chartH - 40 }, input, { labelSize: 38, hrWidth: 5 });
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = `600 26px ${input.ui}`;
  ctx.fillText(niceDate(workout.date).toUpperCase(), P, chartH + 44);
  ctx.fillStyle = "#fff"; ctx.font = `72px ${input.display}`;
  const lines = wrap(ctx, workout.title.toUpperCase(), W - 2 * P).slice(0, 2);
  lines.forEach((l, i) => ctx.fillText(l, P, chartH + 84 + i * 70));
  const s = hrStats(input.hr);
  const cells: [string, string, string][] = [
    [formatClock(workout.totalSec), "DURATION", "#fff"],
    [workout.tss ? String(workout.tss) : "—", "TSS", "#fff"],
    [s ? String(s.min) : "—", "MIN HEART RATE", HR_RED],
    [s ? String(s.max) : "—", "MAX HEART RATE", HR_RED],
  ];
  const gridY = chartH + 84 + lines.length * 70 + 40, cw = (W - 2 * P) / 2, ch = (H - gridY - P) / 2;
  cells.forEach(([v, k, c], i) => {
    const x = P + (i % 2) * cw, y = gridY + Math.floor(i / 2) * ch;
    ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cw - 24, y); ctx.stroke();
    ctx.fillStyle = c; ctx.font = `${Math.min(110, ch * 0.62)}px ${input.display}`; ctx.fillText(v, x, y + 18);
    ctx.fillStyle = c === HR_RED ? "rgba(255,43,43,0.75)" : "rgba(255,255,255,0.5)"; ctx.font = `600 22px ${input.ui}`;
    ctx.fillText(k, x, y + 18 + Math.min(110, ch * 0.62) + 6);
  });
}

/** Story (9:16): huge stacked title, tall profile, a giant red max heart rate. */
function story(ctx: CanvasRenderingContext2D, W: number, H: number, input: SummaryInput) {
  const { workout } = input; const P = 80;
  backdrop(ctx, W, H, hardestColor(input));
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = `600 32px ${input.ui}`;
  ctx.fillText(`${niceDate(workout.date).toUpperCase()}  ·  ${formatClock(workout.totalSec)}${workout.tss ? `  ·  TSS ${workout.tss}` : ""}`, P, 150);
  ctx.fillStyle = "#fff"; ctx.font = `150px ${input.display}`;
  const lines = wrap(ctx, workout.title.toUpperCase(), W - 2 * P).slice(0, 4);
  lines.forEach((l, i) => ctx.fillText(l, P, 210 + i * 138));
  const chartY = 210 + lines.length * 138 + 60;
  drawProfile(ctx, { x: P, y: chartY, w: W - 2 * P, h: H - chartY - 520 }, input, { labelSize: 44, hrWidth: 6 });
  const s = hrStats(input.hr);
  if (s) {
    const y = H - 430;
    ctx.fillStyle = HR_RED; ctx.font = `300px ${input.display}`; ctx.fillText(String(s.max), P + 100, y);
    heart(ctx, P, y + 90, 80, HR_RED);
    ctx.font = `600 30px ${input.ui}`; ctx.fillStyle = "rgba(255,43,43,0.85)";
    ctx.fillText(`MAX BPM   ·   MIN ${s.min}`, P + 6, y + 300);
  }
}

const DRAW: Record<SummaryVariant, { w: number; h: number; draw: typeof data }> = {
  data: { w: 1080, h: 1350, draw: data },
  story: { w: 1080, h: 1920, draw: story },
};

/** Render a summary layout to a fresh canvas at its full share size. */
export function renderSummary(variant: SummaryVariant, input: SummaryInput): HTMLCanvasElement {
  const { w, h, draw } = DRAW[variant];
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx, w, h, input);
  return canvas;
}
