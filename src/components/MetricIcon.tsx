/**
 * Cadence, heart-rate, power, timer and settings icons: one-colour strokes in currentColor,
 * with separate 32 and 64 px optical masters (the 64 is redrawn, not scaled,
 * with a lighter relative stroke). Pick the master by displayed size: `small`
 * for text-sized icons, `large` beside the big ride numbers.
 *
 * Each icon's viewBox is cropped to its ink (path bounds plus half the stroke),
 * so the element's box is the drawing itself. CSS then sits the box's centre
 * on the cap-height centre of the type beside it (see `.metric-icon` in
 * globals.css): exact vertical centring, and spacing measured from the ink.
 *
 * Settings is three mixer faders (picked Nov 2026).
 *
 * The timer's hand is its own path (`.metric-icon__hand`, pivot at the dial
 * centre = the path's start) so it can be spun, as on the loading screen.
 */

export type Metric = "cadence" | "heart" | "power" | "timer" | "settings";

/** Ink bounds [x, y, width, height] per master: getBBox() of the paths, grown by stroke / 2. */
const INK = {
  small: { cadence: [3, 3, 24.392, 26], heart: [3, 4.261, 26, 23.739], power: [6, 3, 20, 26], timer: [5, 2, 22, 27], settings: [4.2, 3.0, 23.6, 26] },
  large: { cadence: [6.25, 6.25, 48.285, 51.5], heart: [6.25, 8.771, 51.5, 46.979], power: [12.25, 6.25, 39.5, 51.5], timer: [9.75, 4.25, 44.5, 54], settings: [8.65, 6.25, 46.7, 51.5] },
} as const;

const MASTERS = {
  small: {
    box: 32,
    stroke: 2,
    cadence: <><path d="M22 26.392A12 12 0 1 1 26.392 10M21 10h5.392V5" /><circle cx="16" cy="16" r="2" /><path d="m17.5 17.5 4.5 4.5m-3 0h6" /></>,
    heart: <><path d="M16 27C13 24.5 4 18 4 11.5 4 4.5 12 3 16 9c4-6 12-4.5 12 2.5C28 18 19 24.5 16 27Z" /><path d="M9 16h3l2-4 4 8 2-4h3" /></>,
    power: <path d="m18 4-11 14h8l-2 10 12-15h-8l1-9Z" />,
    timer: <><circle cx="16" cy="18" r="10" /><path d="M12 3h8m-4 0v5m7 3 3-3" /><path className="metric-icon__hand" d="M16 18l4-4" /></>,
    settings: <><path d="M8 4V17.2M8 22.8V28 M16 4V7.2M16 12.8V28 M24 4V13.2M24 18.8V28" /><circle cx="8" cy="20" r="2.8" /><circle cx="16" cy="10" r="2.8" /><circle cx="24" cy="16" r="2.8" /></>,
  },
  large: {
    box: 64,
    stroke: 3.5,
    cadence: <><path d="M44 52.785A24 24 0 1 1 52.785 20M43 20h9.785v-9.5" /><circle cx="32" cy="32" r="4" /><path d="m35 35 9 9m-6 0h13" /></>,
    heart: <><path d="M32 54C25.5 48.5 8 36 8 23 8 9 24 6 32 18c8-12 24-9 24 5 0 13-17.5 25.5-24 31Z" /><path d="M18 32h6l4-8.5 8 17 4-8.5h6" /></>,
    power: <path d="M36.5 8 14 36h16l-4.5 20L50 26H34l2.5-18Z" />,
    timer: <><circle cx="32" cy="36" r="20.5" /><path d="M24.5 6h15M32 6v9.5m14.5 6 5.5-5.5" /><path className="metric-icon__hand" d="M32 36l8.5-8.5" /></>,
    settings: <><path d="M16 8V34.4M16 45.6V56 M32 8V14.4M32 25.6V56 M48 8V26.4M48 37.6V56" /><circle cx="16" cy="40" r="5.6" /><circle cx="32" cy="20" r="5.6" /><circle cx="48" cy="32" r="5.6" /></>,
  },
} as const;

interface Props {
  metric: Metric;
  /** `small` (32 px master) for text-sized icons, `large` (64 px master) for the ride readouts. */
  size?: "small" | "large";
  className?: string;
}

/** Decorative: the value beside it carries the label for screen readers. Strokes may touch the cropped edge, so overflow stays visible. */
export function MetricIcon({ metric, size = "small", className }: Props) {
  const m = MASTERS[size];
  const [x, y, w, h] = INK[size][metric];
  // --ih: ink height as a fraction of the master square; --ar: ink width / height.
  const style = { "--ih": (h / m.box).toFixed(4), "--ar": (w / h).toFixed(4) } as React.CSSProperties;
  return (
    <svg
      className={`metric-icon${className ? ` ${className}` : ""}`}
      style={style}
      viewBox={`${x} ${y} ${w} ${h}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={m.stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      overflow="visible"
    >
      {m[metric]}
    </svg>
  );
}
