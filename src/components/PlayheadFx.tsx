"use client";

import { useEffect, useRef } from "react";
import { PLAYHEAD_DRAW, type Particle } from "@/lib/playhead-fx";
import type { PlayheadStyle } from "@/lib/settings";

interface Props {
  /** Line position as a fraction of the width (0..1). */
  x: number;
  /** Line height as a fraction of the canvas height (0..1). */
  band: number;
  variant: PlayheadStyle;
  /** Current zone colour, used for the glow. */
  color: string;
}

/**
 * Canvas overlay that draws the glowing "now" line with sparkles and vapour.
 * One animation loop for the component's life; it reads the latest props
 * from a ref, so time ticks and style changes never restart it.
 */
export function PlayheadFx(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const parts: Particle[] = [];
    const owed = { n: 0 };
    let variant = latest.current.variant;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const p = latest.current;
      if (p.variant !== variant) { parts.length = 0; variant = p.variant; }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      if (p.x > 0 && p.x < 1) {
        PLAYHEAD_DRAW[p.variant]({ ctx, px: p.x * canvas.clientWidth, ph: p.band * canvas.clientHeight, dt, t: now / 1000, color: p.color, parts, owed, reduce });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={canvasRef} className="profile__fx" aria-hidden />;
}
