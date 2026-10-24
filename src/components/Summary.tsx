"use client";

import { useEffect, useState } from "react";
import type { Workout } from "@/lib/workout/types";
import type { HrSample } from "@/lib/profile";
import { hrStats, renderSummary, SUMMARY_LABELS, SUMMARY_VARIANTS, type SummaryVariant } from "@/lib/summary-card";
import { formatClock } from "@/lib/workout/duration";
import { useSettings } from "./SettingsProvider";

interface Props {
  workout: Workout;
  hr: HrSample[];
  onDone: () => void;
}

/**
 * Shown automatically when the ride ends: the share image, ready to save.
 * Both layouts are rendered as soon as this mounts, because iOS only allows
 * the share sheet inside the tap itself and canvas encoding is asynchronous.
 */
export function Summary({ workout, hr, onDone }: Props) {
  const { zones, settings } = useSettings();
  const [variant, setVariant] = useState<SummaryVariant>("data");
  const [pngs, setPngs] = useState<Partial<Record<SummaryVariant, { url: string; file: File }>>>({});
  const png = pngs[variant];
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    let off = false;
    const urls: string[] = [];
    void (async () => {
      const root = getComputedStyle(document.documentElement);
      const display = root.getPropertyValue("--font-display").trim() || "sans-serif";
      const ui = root.getPropertyValue("--font-ui").trim() || "system-ui, sans-serif";
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
  return (
    <main className="screen summary">
      <div className="summary__wrap">
        <header>
          <p className="muted small">Ride complete · {formatClock(workout.totalSec)}{s ? ` · ♥ ${s.min}–${s.max}` : ""}</p>
          <h1>Nice work.</h1>
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
        <p className="muted small">{SUMMARY_LABELS[variant].name} · {SUMMARY_LABELS[variant].size}</p>
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
