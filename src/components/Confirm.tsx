"use client";

import type { Workout } from "@/lib/workout/types";
import { clock, wattsLabel, zoneLabel } from "@/lib/timer";
import { Fades } from "@/components/animate-ui/primitives/effects/fade";
import { RippleButton, RippleButtonRipples } from "@/components/animate-ui/primitives/buttons/ripple";
import type { HeartRateState } from "@/hooks/use-heart-rate";

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
  const days = Array.from(new Map(result.days.map((d) => [d.date, d])).values()).sort((a, b) => a.date.localeCompare(b.date));
  const w = selected;
  const issues = [...w.warnings, ...w.unparsed.map((u) => `Not understood: ${u}`), ...result.warnings];

  return (
    <main className="screen">
      <div className="confirm stack" style={{ maxWidth: 720 }}>
        <Fades key={w.date} holdDelay={0.06} initialOpacity={0} transition={{ duration: 0.3 }}>
        <header>
          <p className="muted">
            {niceDate(w.date)}
            {w.date === result.date ? " · today" : ""}
            {result.demo ? " · demo data" : ""}
          </p>
          <h1>{w.title}</h1>
          {!w.isRestDay && (
            <p className="muted">
              {clock(w.totalSec)} total · {w.blocks.length} {w.blocks.length === 1 ? "block" : "blocks"}
              {w.tss ? ` · TSS ${w.tss}` : ""}
            </p>
          )}
        </header>

        <div className="days" role="tablist" aria-label="Days" hidden={days.length < 2}>
          {days.map((d) => (
              <button key={d.date} role="tab" aria-current={d.date === w.date} onClick={() => onSelect(d)}>
                {niceDate(d.date)}{d.isRestDay ? " · rest" : ""}
              </button>
          ))}
        </div>

        <div className="notice" role="alert" hidden={issues.length === 0}>
          Check before you start:
          <ul>{issues.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>

        {w.isRestDay ? (
          <p>Rest day. Nothing to ride.</p>
        ) : (
          <table className="blocks">
            <tbody>
              {w.blocks.map((b) => (
                <tr key={b.index}>
                  <td className="num">{b.index + 1}</td>
                  <td>
                    <span className={`kind kind-${b.kind}`} aria-hidden />
                    {zoneLabel(b)}
                    {b.set && <span className="set">{b.set.index} of {b.set.count}</span>}
                    {b.target.cadenceRpm && <span className="set">{b.target.cadenceRpm.lo}–{b.target.cadenceRpm.hi} rpm</span>}
                  </td>
                  <td className="dur">{clock(b.durationSec)}</td>
                  <td className="watts">{wattsLabel(b) ? `${wattsLabel(b)} W` : <span className="muted">no target</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <HeartRateRow hr={heartRate} />

        <div className="actions">
          {!w.isRestDay && (
            <RippleButton className="primary" onClick={onStart} hoverScale={1.03} tapScale={0.96}>
              Start
              <RippleButtonRipples color="rgba(0, 0, 0, 0.25)" />
            </RippleButton>
          )}
          <button onClick={onReload}>Reload</button>
        </div>
        <p className="muted" style={{ whiteSpace: "pre-line", fontSize: "0.9rem" }} hidden={!w.description}>{w.description}</p>
        </Fades>
      </div>
    </main>
  );
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
        <span aria-hidden>♥</span> {live ? (hr.bpm ?? "—") : hr.status === "reconnecting" ? "reconnecting…" : hr.status === "connecting" ? "connecting…" : "not connected"}
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
