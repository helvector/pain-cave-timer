"use client";

import type { Workout } from "@/lib/workout/types";
import { clock, wattsLabel, zoneLabel } from "@/lib/timer";

interface Props {
  result: { date: string; days: Workout[]; warnings: string[]; demo?: boolean; email?: { subject: string } };
  selected: Workout;
  onSelect: (w: Workout) => void;
  onStart: () => void;
  onReload: () => void;
}

function niceDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/** One screen, read once, then Start. Everything the parser was unsure about is shown here. */
export function Confirm({ result, selected, onSelect, onStart, onReload }: Props) {
  const days = Array.from(new Map(result.days.map((d) => [d.date, d])).values()).sort((a, b) => a.date.localeCompare(b.date));
  const w = selected;
  const issues = [...w.warnings, ...w.unparsed.map((u) => `Not understood: ${u}`), ...result.warnings];

  return (
    <main className="screen">
      <div className="confirm stack" style={{ maxWidth: 720 }}>
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

        {days.length > 1 && (
          <div className="days" role="tablist" aria-label="Days">
            {days.map((d) => (
              <button key={d.date} role="tab" aria-current={d.date === w.date} onClick={() => onSelect(d)}>
                {niceDate(d.date)}{d.isRestDay ? " · rest" : ""}
              </button>
            ))}
          </div>
        )}

        {issues.length > 0 && (
          <div className="notice" role="alert">
            Check before you start:
            <ul>{issues.map((m, i) => <li key={i}>{m}</li>)}</ul>
          </div>
        )}

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

        <div className="actions">
          {!w.isRestDay && <button className="primary" onClick={onStart}>Start</button>}
          <button onClick={onReload}>Reload</button>
        </div>
        {w.description && <p className="muted" style={{ whiteSpace: "pre-line", fontSize: "0.9rem" }}>{w.description}</p>}
      </div>
    </main>
  );
}
