import type { PlayheadStyle } from "./settings";

/**
 * Canvas drawing for the glowing "now" line on the workout profile. Each style
 * draws a vertical line at px from the top to ph, plus particles that trail
 * off its left edge (behind the rider: what has just been ridden). Pure apart
 * from the canvas context, so styles are easy to compare and tune.
 */

export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; seed: number;
}

export interface Frame {
  ctx: CanvasRenderingContext2D;
  /** Line x and height, in CSS pixels. */
  px: number; ph: number;
  dt: number; t: number;
  color: string;
  parts: Particle[];
  /** Fractional particles owed from previous frames. */
  owed: { n: number };
  reduce: boolean;
}

const MAX_PARTICLES = 220;

export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, a))})`;
}

function spawn(f: Frame, perSecond: number, make: () => Omit<Particle, "life" | "max" | "seed">, life: [number, number]) {
  if (f.reduce) return;
  f.owed.n += perSecond * f.dt;
  while (f.owed.n >= 1 && f.parts.length < MAX_PARTICLES) {
    f.owed.n -= 1;
    const max = life[0] + Math.random() * (life[1] - life[0]);
    f.parts.push({ ...make(), life: max, max, seed: Math.random() * 1000 });
  }
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

function line(f: Frame, width: number, stroke: string, glow: string, blur: number) {
  const { ctx } = f;
  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = blur;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(f.px, 0);
  ctx.lineTo(f.px, f.ph);
  ctx.stroke();
  ctx.restore();
}

function haze(f: Frame, width: number, alpha: number, hex: string) {
  const g = f.ctx.createLinearGradient(f.px - width, 0, f.px, 0);
  g.addColorStop(0, rgba(hex, 0));
  g.addColorStop(1, rgba(hex, alpha));
  f.ctx.fillStyle = g;
  f.ctx.fillRect(f.px - width, 0, width, f.ph);
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

/** Ember: white-hot line, sparks drifting up and back, a flickering heat haze. */
function ember(f: Frame) {
  haze(f, 46, 0.2 + 0.06 * Math.sin(f.t * 5), f.color);
  spawn(f, 42, () => ({ x: f.px, y: Math.random() * f.ph, vx: -(20 + Math.random() * 50), vy: -(6 + Math.random() * 26), size: 0.8 + Math.random() * 1.3 }), [0.5, 1.1]);
  step(f, 0.6);
  for (const p of f.parts) {
    const k = p.life / p.max;
    f.ctx.fillStyle = k > 0.6 ? rgba("#fff6d8", k) : rgba(f.color, k * 1.4);
    f.ctx.beginPath(); f.ctx.arc(p.x, p.y, p.size * (0.6 + k * 0.6), 0, Math.PI * 2); f.ctx.fill();
  }
  line(f, 2, "#ffffff", f.color, 14 + 4 * Math.sin(f.t * 6));
}

/** Comet: bright head with a long vapour tail and twinkling stars in it. */
function comet(f: Frame) {
  haze(f, 110, 0.28, "#ffffff");
  haze(f, 36, 0.32, f.color);
  for (let k = 0; k < 6; k++) {
    const y = (f.ph * (k + 0.5)) / 6 + Math.sin(f.t * 1.3 + k * 1.7) * 6;
    const g = f.ctx.createLinearGradient(f.px - 90, 0, f.px, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(255,255,255,0.22)");
    f.ctx.fillStyle = g; f.ctx.fillRect(f.px - 90, y - 1.5, 90, 3);
  }
  spawn(f, 12, () => ({ x: f.px - Math.random() * 100, y: Math.random() * f.ph, vx: -6, vy: 0, size: 1.5 + Math.random() * 2.2 }), [0.4, 0.9]);
  step(f);
  for (const p of f.parts) {
    const k = Math.sin((1 - p.life / p.max) * Math.PI);
    star(f.ctx, p.x, p.y, p.size * (0.4 + k), rgba("#ffffff", 0.9 * k));
  }
  line(f, 3, "#ffffff", f.color, 22);
}

/** Plasma: zone-coloured line that breathes, smoke puffs and fast sparks. */
function plasma(f: Frame) {
  const pulse = 0.5 + 0.5 * Math.sin(f.t * 4);
  spawn(f, 14, () => ({ x: f.px - 2, y: Math.random() * f.ph, vx: -(15 + Math.random() * 25), vy: (Math.random() - 0.5) * 10, size: 4 }), [1.2, 2]);
  spawn(f, 6, () => ({ x: f.px, y: Math.random() * f.ph, vx: -(70 + Math.random() * 60), vy: (Math.random() - 0.5) * 30, size: -1 }), [0.25, 0.5]);
  step(f);
  for (const p of f.parts) {
    const k = p.life / p.max;
    if (p.size < 0) {
      f.ctx.fillStyle = rgba("#ffffff", k); f.ctx.fillRect(p.x, p.y, 2, 1);
    } else {
      const r = 4 + (1 - k) * 18;
      const g = f.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, rgba(f.color, 0.18 * k)); g.addColorStop(1, rgba(f.color, 0));
      f.ctx.fillStyle = g; f.ctx.beginPath(); f.ctx.arc(p.x, p.y, r, 0, Math.PI * 2); f.ctx.fill();
    }
  }
  line(f, 2 + pulse * 1.5, f.color, f.color, 10 + pulse * 14);
  line(f, 1, "#ffffff", "#ffffff", 0);
}

/** Stardust: fine line shedding a slow drift of glittering dust. */
function stardust(f: Frame) {
  haze(f, 20, 0.14, "#ffffff");
  spawn(f, 60, () => ({ x: f.px, y: Math.random() * f.ph, vx: -(8 + Math.random() * 14), vy: (Math.random() - 0.5) * 6, size: 0.6 + Math.random() * 0.8 }), [1.5, 3]);
  spawn(f, 3, () => ({ x: f.px - Math.random() * 30, y: Math.random() * f.ph * 0.6, vx: -4, vy: 0, size: -(2 + Math.random() * 2) }), [0.6, 1.2]);
  step(f);
  for (const p of f.parts) {
    const k = p.life / p.max;
    if (p.size < 0) {
      star(f.ctx, p.x, p.y, -p.size * Math.sin(k * Math.PI), rgba("#ffffff", 0.95 * Math.sin(k * Math.PI)));
    } else {
      const tw = 0.6 + 0.4 * Math.sin(f.t * 9 + p.seed);
      f.ctx.fillStyle = rgba("#ffffff", 0.8 * k * tw);
      f.ctx.fillRect(p.x, p.y + Math.sin(f.t * 2 + p.seed) * 1.5, p.size, p.size);
    }
  }
  line(f, 1.5, "#ffffff", "#ffffff", 10);
}

export const PLAYHEAD_DRAW: Record<PlayheadStyle, (f: Frame) => void> = { ember, comet, plasma, stardust };
