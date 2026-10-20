import type { PlayheadStyle } from "./settings";

/**
 * Canvas drawing for the "now" line on the workout profile: a black line from
 * the top of the current bar to the bottom of the screen, haloed in the zone
 * colour, with particles trailing off its left edge (what was just ridden).
 * Everything scales with `intensity` (0 = resting heart rate, 1 = max): more,
 * faster, bigger particles and a hotter glow as the rider works harder.
 */

export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; seed: number;
}

export interface Frame {
  ctx: CanvasRenderingContext2D;
  /** Line x and its vertical extent, in CSS pixels. */
  px: number; y0: number; y1: number;
  dt: number; t: number;
  color: string;
  /** 0..1 from heart rate. */
  intensity: number;
  parts: Particle[];
  /** Fractional particles owed from previous frames. */
  owed: { n: number };
  reduce: boolean;
}

const MAX_PARTICLES = 320;

export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, a))})`;
}

/** Scale a base value by intensity: `lo` at rest, `hi` at max. */
const by = (f: Frame, lo: number, hi: number) => lo + (hi - lo) * f.intensity;
const randY = (f: Frame) => f.y0 + Math.random() * (f.y1 - f.y0);

function spawn(f: Frame, perSecond: number, make: () => Omit<Particle, "life" | "max" | "seed">, life: [number, number]) {
  if (f.reduce) return;
  f.owed.n += perSecond * f.dt;
  while (f.owed.n >= 1 && f.parts.length < MAX_PARTICLES) {
    f.owed.n -= 1;
    const max = life[0] + Math.random() * (life[1] - life[0]);
    f.parts.push({ ...make(), life: max, max, seed: Math.random() * 1000 });
  }
  if (f.parts.length >= MAX_PARTICLES) f.owed.n = 0;
}

function step(f: Frame, drag = 0) {
  for (const p of f.parts) {
    p.life -= f.dt;
    p.x += p.vx * f.dt;
    p.y += p.vy * f.dt;
    if (drag) { p.vx *= 1 - drag * f.dt; p.vy *= 1 - drag * f.dt; }
  }
  for (let i = f.parts.length - 1; i >= 0; i--) if (f.parts[i].life <= 0) f.parts.splice(i, 1);
}

/** The black line itself, with a halo of `glow` around it. */
function line(f: Frame, width: number, glow: string, blur: number) {
  const { ctx } = f;
  ctx.save();
  ctx.lineCap = "butt";
  // Halo first (drawn by the shadow of a glow-coloured stroke), then the black core on top.
  ctx.shadowColor = glow;
  ctx.shadowBlur = blur;
  ctx.strokeStyle = glow;
  ctx.lineWidth = width + 1;
  ctx.beginPath(); ctx.moveTo(f.px, f.y0); ctx.lineTo(f.px, f.y1); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(f.px, f.y0); ctx.lineTo(f.px, f.y1); ctx.stroke();
  ctx.restore();
}

function haze(f: Frame, width: number, alpha: number, hex: string) {
  const g = f.ctx.createLinearGradient(f.px - width, 0, f.px, 0);
  g.addColorStop(0, rgba(hex, 0));
  g.addColorStop(1, rgba(hex, alpha));
  f.ctx.fillStyle = g;
  f.ctx.fillRect(f.px - width, f.y0, width, f.y1 - f.y0);
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

/** Ember: black line, sparks drifting up and back, a flickering heat haze. */
function ember(f: Frame) {
  haze(f, by(f, 34, 70), by(f, 0.14, 0.38) + 0.06 * Math.sin(f.t * by(f, 4, 11)), f.color);
  const speed = by(f, 0.8, 2.2);
  spawn(f, by(f, 25, 140), () => ({ x: f.px - 1, y: randY(f), vx: -(20 + Math.random() * 50) * speed, vy: -(6 + Math.random() * 26) * speed, size: (0.8 + Math.random() * 1.3) * by(f, 0.9, 1.6) }), [0.5, 1.1]);
  step(f, 0.6);
  for (const p of f.parts) {
    const k = p.life / p.max;
    f.ctx.fillStyle = k > 0.6 ? rgba("#fff6d8", k) : rgba(f.color, k * 1.4);
    f.ctx.beginPath(); f.ctx.arc(p.x, p.y, p.size * (0.6 + k * 0.6), 0, Math.PI * 2); f.ctx.fill();
  }
  line(f, 2.5, f.color, by(f, 10, 30) + 4 * Math.sin(f.t * by(f, 5, 12)));
}

/** Comet: black line with a long vapour tail and twinkling stars in it. */
function comet(f: Frame) {
  const tail = by(f, 80, 170);
  haze(f, tail, by(f, 0.18, 0.4), "#ffffff");
  haze(f, tail * 0.35, by(f, 0.22, 0.5), f.color);
  const streaks = Math.round(by(f, 5, 11));
  for (let k = 0; k < streaks; k++) {
    const y = f.y0 + ((f.y1 - f.y0) * (k + 0.5)) / streaks + Math.sin(f.t * by(f, 1.2, 3) + k * 1.7) * 6;
    const g = f.ctx.createLinearGradient(f.px - tail * 0.85, 0, f.px, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(1, rgba("#ffffff", by(f, 0.16, 0.34)));
    f.ctx.fillStyle = g; f.ctx.fillRect(f.px - tail * 0.85, y - 1.5, tail * 0.85, 3);
  }
  spawn(f, by(f, 8, 45), () => ({ x: f.px - Math.random() * tail, y: randY(f), vx: -by(f, 5, 30), vy: 0, size: (1.5 + Math.random() * 2.2) * by(f, 0.9, 1.5) }), [0.4, 0.9]);
  step(f);
  for (const p of f.parts) {
    const k = Math.sin((1 - p.life / p.max) * Math.PI);
    star(f.ctx, p.x, p.y, p.size * (0.4 + k), rgba("#ffffff", 0.9 * k));
  }
  line(f, 3, "#ffffff", by(f, 14, 34));
}

/** Plasma: black line in a breathing zone-coloured halo, smoke puffs and fast sparks. */
function plasma(f: Frame) {
  const pulse = 0.5 + 0.5 * Math.sin(f.t * by(f, 3, 11));
  const speed = by(f, 0.8, 2);
  spawn(f, by(f, 10, 45), () => ({ x: f.px - 2, y: randY(f), vx: -(15 + Math.random() * 25) * speed, vy: (Math.random() - 0.5) * 10 * speed, size: 4 }), [1.2, 2]);
  spawn(f, by(f, 4, 40), () => ({ x: f.px, y: randY(f), vx: -(70 + Math.random() * 60) * speed, vy: (Math.random() - 0.5) * 30, size: -1 }), [0.25, 0.5]);
  step(f);
  for (const p of f.parts) {
    const k = p.life / p.max;
    if (p.size < 0) {
      f.ctx.fillStyle = rgba("#ffffff", k); f.ctx.fillRect(p.x, p.y, 2 * by(f, 1, 1.8), 1);
    } else {
      const r = (4 + (1 - k) * 18) * by(f, 0.9, 1.5);
      const g = f.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, rgba(f.color, by(f, 0.16, 0.3) * k)); g.addColorStop(1, rgba(f.color, 0));
      f.ctx.fillStyle = g; f.ctx.beginPath(); f.ctx.arc(p.x, p.y, r, 0, Math.PI * 2); f.ctx.fill();
    }
  }
  line(f, 2.5 + pulse * by(f, 1, 2.5), f.color, by(f, 10, 22) + pulse * by(f, 10, 26));
}

/** Stardust: black line shedding a drift of glittering dust. */
function stardust(f: Frame) {
  haze(f, by(f, 16, 40), by(f, 0.1, 0.26), "#ffffff");
  spawn(f, by(f, 40, 220), () => ({ x: f.px - 1, y: randY(f), vx: -(8 + Math.random() * 14) * by(f, 0.8, 2.4), vy: (Math.random() - 0.5) * 6, size: (0.6 + Math.random() * 0.8) * by(f, 0.9, 1.5) }), [1.5, 3]);
  spawn(f, by(f, 2, 14), () => ({ x: f.px - Math.random() * 30, y: f.y0 + Math.random() * (f.y1 - f.y0) * 0.6, vx: -by(f, 4, 14), vy: 0, size: -(2 + Math.random() * 2) * by(f, 1, 1.6) }), [0.6, 1.2]);
  step(f);
  for (const p of f.parts) {
    const k = p.life / p.max;
    if (p.size < 0) {
      star(f.ctx, p.x, p.y, -p.size * Math.sin(k * Math.PI), rgba("#ffffff", 0.95 * Math.sin(k * Math.PI)));
    } else {
      const tw = 0.6 + 0.4 * Math.sin(f.t * by(f, 7, 16) + p.seed);
      f.ctx.fillStyle = rgba("#ffffff", 0.8 * k * tw);
      f.ctx.fillRect(p.x, p.y + Math.sin(f.t * 2 + p.seed) * 1.5, p.size, p.size);
    }
  }
  line(f, 2, "#ffffff", by(f, 8, 24));
}

export const PLAYHEAD_DRAW: Record<PlayheadStyle, (f: Frame) => void> = { ember, comet, plasma, stardust };
