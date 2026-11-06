"use client";

import type { Workout } from "@/lib/workout/types";
import { RippleButton, RippleButtonRipples } from "@/components/animate-ui/primitives/buttons/ripple";
import type { HeartRateState } from "@/hooks/use-heart-rate";
import { useSettings } from "./SettingsProvider";
import { ConfirmHero } from "./ConfirmVariants";
import { MetricIcon } from "./MetricIcon";

interface Props {
  result: { date: string; days: Workout[]; warnings: string[]; demo?: boolean; email?: { subject: string } };
  selected: Workout;
  onSelect: (w: Workout) => void;
  onStart: () => void;
  onReload: () => void;
  heartRate: HeartRateState;
}

function niceDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/** One screen, read once, then Start. Everything the parser was unsure about is shown here. */
export function Confirm({ result, selected, onSelect, onStart, onReload, heartRate }: Props) {
  const { zones } = useSettings();
  const days = Array.from(new Map(result.days.map((d) => [d.date, d])).values()).sort((a, b) => a.date.localeCompare(b.date));
  const w = selected;
  const issues = [...w.warnings, ...w.unparsed.map((u) => `Not understood: ${u}`), ...result.warnings];

  const parts = {
      w, zones,
      dateLine: `${niceDate(w.date)}${w.date === result.date ? " · today" : ""}${result.demo ? " · demo data" : ""}`,
      dayTabs: days.length > 1 ? (
        <div className="days" role="tablist" aria-label="Days">
          {days.map((d) => (
            <button key={d.date} role="tab" aria-current={d.date === w.date} onClick={() => onSelect(d)}>
              {niceDate(d.date)}{d.isRestDay ? " · rest" : !d.blocks.length && d.strength?.length ? " · gym" : ""}
            </button>
          ))}
        </div>
      ) : null,
      issues: issues.length ? <div className="notice" role="alert">Check before you start:<ul>{issues.map((m, i) => <li key={i}>{m}</li>)}</ul></div> : null,
      heartRate: <HeartRateRow hr={heartRate} />,
      // Nothing to ride on a rest day or a gym-only day.
      startButton: w.isRestDay || w.blocks.length === 0 ? null : (
        <RippleButton className="primary" onClick={onStart} hoverScale={1.03} tapScale={0.96}>
          Start
          <RippleButtonRipples color="rgba(0, 0, 0, 0.25)" />
        </RippleButton>
      ),
      reloadButton: <button onClick={onReload}>Reload</button>,
      demo: result.demo,
    };
  return <ConfirmHero {...parts} />;
}

/** Optional live heart rate: a readout, not a target. Whoop needs Broadcast Heart Rate on. */
function HeartRateRow({ hr }: { hr: HeartRateState }) {
  if (hr.status === "unsupported") {
    return (
      <p className="muted hr-row">
        Heart rate needs Web Bluetooth: Chrome or Edge on a computer or Android, or the Bluefy browser on iPhone.
      </p>
    );
  }
  const live = hr.status === "connected";
  return (
    <div className="row hr-row">
      <span className={live ? "" : "muted"}>
        <MetricIcon metric="heart" className="hr-row__icon" /> {live ? (hr.bpm ?? "—") : hr.status === "reconnecting" ? "reconnecting…" : hr.status === "connecting" ? "connecting…" : "not connected"}
        {live && hr.name ? <span className="muted"> · {hr.name}</span> : null}
      </span>
      {hr.status === "idle" ? (
        <button onClick={hr.connect}>Connect Whoop</button>
      ) : (
        <button onClick={hr.disconnect} disabled={hr.status === "connecting"}>Disconnect</button>
      )}
      {hr.error && <span className="muted">{hr.error}</span>}
    </div>
  );
}
