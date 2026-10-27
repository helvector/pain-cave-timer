"use client";

import { useEffect, useState } from "react";
import type { Workout } from "@/lib/workout/types";
import type { HrSample } from "@/lib/profile";
import { hrStats, renderSummary, SUMMARY_LABELS, SUMMARY_VARIANTS, type SummaryVariant } from "@/lib/summary-card";
import { formatClock } from "@/lib/workout/duration";
import { useSettings } from "./SettingsProvider";
import { MetricIcon } from "./MetricIcon";

interface Props {
  workout: Workout;
  /** Time actually ridden: the full session, or where an early exit stopped it. */
  elapsedSec: number;
  hr: HrSample[];
  onDone: () => void;
}

/**
 * Shown automatically when the ride ends: the share image, ready to save.
 * Both layouts are rendered as soon as this mounts, because iOS only allows
 * the share sheet inside the tap itself and canvas encoding is asynchronous.
 */
/** A CSS font-family with its var()s resolved, which canvas `font` needs. */
function resolvedFamily(family: string): string {
  const probe = document.createElement("span");
  probe.style.fontFamily = family;
  document.body.appendChild(probe);
  const value = getComputedStyle(probe).fontFamily;
  probe.remove();
  return value;
}

export function Summary({ workout, elapsedSec, hr, onDone }: Props) {
  const { zones, settings } = useSettings();
  const [variant, setVariant] = useState<SummaryVariant>("data");
  const [pngs, setPngs] = useState<Partial<Record<SummaryVariant, { url: string; file: File }>>>({});
  const png = pngs[variant];
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    let off = false;
    const urls: string[] = [];
    void (async () => {
      const display = resolvedFamily("var(--font-display)") || "sans-serif";
      const ui = resolvedFamily("var(--font-ui)") || "system-ui, sans-serif";
      await Promise.all([document.fonts.load(`100px ${display}`), document.fonts.load(`600 30px ${ui}`)]).catch(() => undefined);
      for (const v of SUMMARY_VARIANTS) {
        const canvas = renderSummary(v, { workout, hr, zones, hrRest: settings.hrRest, hrMax: settings.hrMax, display, ui });
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
        if (!blob || off) return;
        const url = URL.createObjectURL(blob);
        urls.push(url);
        setPngs((p) => ({ ...p, [v]: { url, file: new File([blob], `pain-cave-${workout.date}-${v}.png`, { type: "image/png" }) } }));
      }
    })();
    return () => { off = true; urls.forEach((u) => URL.revokeObjectURL(u)); };
  }, [workout, hr, zones, settings.hrRest, settings.hrMax]);

  const save = () => {
    if (!png) return;
    const data = { files: [png.file], title: workout.title };
    // Must run synchronously inside the tap for iOS to allow the share sheet.
    if (typeof navigator.canShare === "function" && navigator.canShare(data)) {
      navigator.share(data).catch((err: unknown) => {
        if ((err as { name?: string })?.name !== "AbortError") setFallback(true);
      });
    } else {
      setFallback(true);
    }
  };

  const s = hrStats(hr);
  const complete = elapsedSec >= workout.totalSec - 1;
  // Intervals finished: a multi-step interval counts once, on its last step.
  const intervals = workout.blocks.filter((b) => b.kind === "work" && (!b.part || b.part.index === b.part.count));
  const intervalsDone = intervals.filter((b) => b.startSec + b.durationSec <= elapsedSec + 1).length;
  const title = workout.title.replace(/\s*\(demo\)$/, "");
  return (
    <main className="screen summary">
      <div className="summary__wrap">
        <header className="summary__head">
          <h1>{title}</h1>
          <p className="summary__line">
            <span>{formatClock(Math.round(elapsedSec))} {complete ? "ridden" : <>of {formatClock(workout.totalSec)}</>}</span>
            {intervals.length > 0 && <span>{intervalsDone} of {intervals.length} intervals</span>}
            {s && <span className="summary__hr"><MetricIcon metric="heart" className="summary__hr-icon" />Peak {s.max}</span>}
          </p>
          {!complete && <p className="muted">Ended early.</p>}
        </header>
        <div className="summary__pick" role="tablist" aria-label="Image layout">
          {SUMMARY_VARIANTS.map((v) => (
            <button key={v} role="tab" aria-selected={v === variant} className={v === variant ? "on" : ""} onClick={() => { setVariant(v); setFallback(false); }}>
              {SUMMARY_LABELS[v].name}
            </button>
          ))}
        </div>
        <div className={`summary__card summary__card--${variant}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL, nothing for next/image to optimise */}
          {png ? <img src={png.url} alt={`${workout.title} ride summary`} /> : <div className="summary__loading">Drawing your ride…</div>}
        </div>
        <div className="actions">
          <button className="primary" onClick={save} disabled={!png}>Save to Photos</button>
          <button onClick={onDone}>Done</button>
        </div>
      </div>

      {fallback && png && (
        <div className="summary__fallback" role="dialog" aria-label="Save image">
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL; long-press saving needs a plain img */}
          <img src={png.url} alt={`${workout.title} ride summary`} />
          <p>Press and hold the image, then choose <b>Save to Photos</b>.</p>
          <div className="row">
            <a className="button" href={png.url} download={png.file.name}>Download instead</a>
            <button onClick={() => setFallback(false)}>Close</button>
          </div>
        </div>
      )}
    </main>
  );
}
