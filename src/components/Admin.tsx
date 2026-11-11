"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Workout } from "@/lib/workout/types";
import { Cues } from "@/lib/audio";
import {
  COUNTDOWN_OPTIONS, DEFAULT_SETTINGS, hrIntensity, SECOND_CALL_OPTIONS, PLAYHEAD_LABELS, PLAYHEAD_STYLES, resolveZones, validateSettings, zoneTopsFromFtp, ZONE_TOP_PCTS,
  type AudioSettings, type PlayheadStyle, type Settings,
} from "@/lib/settings";
import { useSettings } from "./SettingsProvider";
import { MetricIcon } from "./MetricIcon";
import { WorkoutProfile } from "./WorkoutProfile";

const TOKEN_KEY = "pct.token";
const readToken = () => { try { return localStorage.getItem(TOKEN_KEY) ?? ""; } catch { return ""; } };

/** /admin: edit power zones (coach's table), zone colours, heart rate, audio cues and the "now" line style. */
export function Admin() {
  const { settings } = useSettings();
  // Remount the editor when the server copy arrives so the draft starts from it.
  return <Editor key={settings.updatedAt ?? "local"} initial={settings} />;
}

/** Sections, numbered to match the sticky sub nav. */
const SECTIONS = [
  { id: "zones", nav: "Zones", title: "Power zones" },
  { id: "heart", nav: "Heart rate", title: "Heart rate" },
  { id: "audio", nav: "Audio", title: "Audio cues" },
  { id: "preview", nav: "Preview", title: "Preview" },
  { id: "line", nav: "Now line", title: "\u201cNow\u201d line" },
  { id: "save", nav: "Save", title: "Save" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];
const num = (i: number) => String(i + 1).padStart(2, "0");

/** The section whose heading was last scrolled past the top. */
function useActiveSection(): SectionId {
  const [active, setActive] = useState<SectionId>("zones");
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    const pick = () => {
      const line = 140;
      let current: SectionId = SECTIONS[0].id;
      for (const el of els) if (el.getBoundingClientRect().top <= line) current = el.id as SectionId;
      // At the very bottom the last section can't reach the line; count it as current.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = els[els.length - 1].id as SectionId;
      setActive(current);
    };
    const io = new IntersectionObserver(pick, { rootMargin: "0px 0px -60% 0px", threshold: [0, 1] });
    els.forEach((e) => io.observe(e));
    window.addEventListener("scroll", pick, { passive: true });
    return () => { io.disconnect(); window.removeEventListener("scroll", pick); };
  }, []);
  return active;
}

/** Sticky, sideways-scrolling numbered tabs; the current section is underlined. */
function SubNav({ active }: { active: SectionId }) {
  return (
    <nav className="snav" aria-label="Settings sections">
      <div className="snav__track">
        {SECTIONS.map((s, i) => (
          <a key={s.id} href={`#${s.id}`} aria-current={active === s.id ? "location" : undefined}>
            <span className="snav__n">{num(i)}</span>
            {s.nav}
          </a>
        ))}
      </div>
    </nav>
  );
}

function Editor({ initial }: { initial: Settings }) {
  const { apply } = useSettings();
  const [draft, setDraft] = useState<Settings>(initial);
  const [ftp, setFtp] = useState(initial.ftp ? String(initial.ftp) : "");
  const [token, setToken] = useState(readToken);
  const [status, setStatus] = useState<{ kind: "ok" | "error" | "busy"; text: string }>();
  const [sample, setSample] = useState<Workout>();
  const [clock, setClock] = useState(0);
  const [previewBpm, setPreviewBpm] = useState(150);

  // A real session to preview with: last week's over-unders (every zone up to threshold).
  useEffect(() => {
    let off = false;
    void fetch("/api/workout?demo=1&fixture=overunder", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (!off) setSample(d.workout); })
      .catch(() => undefined);
    return () => { off = true; };
  }, []);
  // Sweep the preview playhead through the session: one ride-minute per second.
  useEffect(() => {
    const id = setInterval(() => setClock((c) => c + 0.1), 100);
    return () => clearInterval(id);
  }, []);

  const zones = useMemo(() => resolveZones(draft.zones), [draft.zones]);
  const check = useMemo(() => validateSettings({ ...draft, ftp: ftp || undefined }), [draft, ftp]);
  const elapsed = sample ? (clock * 60) % sample.totalSec : 0;
  const current = sample?.blocks.findIndex((b) => elapsed >= b.startSec && elapsed < b.startSec + b.durationSec) ?? -1;
  const intensity = hrIntensity(previewBpm, draft.hrRest, draft.hrMax);
  const pick = (d: Settings) => ({ z: d.zones, p: d.playhead, r: d.hrRest, m: d.hrMax, a: d.audio });
  const setAudio = (patch: Partial<AudioSettings>) => setDraft((d) => ({ ...d, audio: { ...d.audio, ...patch } }));
  const cues = useMemo(() => new Cues(), []);
  /** Hear a cue. The tap unlocks audio, as the Start tap does on the ride screen. */
  const hear = async (what: "countdown" | "lastMinute" | "secondCall") => {
    await cues.unlock();
    if (what === "lastMinute") { cues.play("lastMinute"); return; }
    if (what === "secondCall") { cues.play(draft.audio.secondCall === 15 ? "fifteen" : "thirty"); return; }
    const n = draft.audio.countdown;
    for (let i = 0; i < n; i++) setTimeout(() => cues.play("tick"), i * 1000);
    setTimeout(() => cues.play("work"), n * 1000);
  };
  const dirty = JSON.stringify(pick(draft)) !== JSON.stringify(pick(initial));

  const setZone = (i: number, patch: Partial<Settings["zones"][number]>) =>
    setDraft((d) => ({ ...d, zones: d.zones.map((z, k) => (k === i ? { ...z, ...patch } : z)) }));

  const calculate = () => {
    const f = Number(ftp);
    if (!(f > 50 && f < 1000)) { setStatus({ kind: "error", text: "Enter an FTP between 50 and 1000 W." }); return; }
    const tops = zoneTopsFromFtp(f);
    setDraft((d) => ({ ...d, zones: d.zones.map((z, i) => ({ ...z, hi: tops[i] })) }));
    setStatus({ kind: "ok", text: `Zones calculated from ${f} W. Adjust any number, then save.` });
  };

  const save = async () => {
    if (!check.ok) { setStatus({ kind: "error", text: check.error }); return; }
    if (!token.trim()) { setStatus({ kind: "error", text: "Enter your access token to save." }); return; }
    setStatus({ kind: "busy", text: "Saving…" });
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.trim()}` },
        body: JSON.stringify(check.settings),
      });
      const body = await res.json();
      if (!res.ok) { setStatus({ kind: "error", text: res.status === 401 ? "That token was rejected." : body.error ?? `HTTP ${res.status}` }); return; }
      try { localStorage.setItem(TOKEN_KEY, token.trim()); } catch { /* private mode */ }
      apply(body);
      setStatus({ kind: "ok", text: "Saved. Every device picks this up the next time the app loads." });
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    }
  };

  const preview = (style: PlayheadStyle, className: string) =>
    sample ? (
      <WorkoutProfile workout={sample} elapsedSec={elapsed} currentIndex={current >= 0 ? current : undefined} zones={zones} playhead={style} intensity={intensity} className={className} />
    ) : (
      <div className={`profile ${className} admin__loading`}>Loading sample…</div>
    );

  const active = useActiveSection();
  const heading = (id: SectionId) => {
    const i = SECTIONS.findIndex((x) => x.id === id);
    return <h2><span className="admin__n">{num(i)}</span>{SECTIONS[i].title}</h2>;
  };

  return (
    <main className="screen admin">
      <div className="stack admin__wrap">
        <header className="admin__header">
          <h1><MetricIcon metric="settings" size="large" className="admin__icon" />Settings</h1>
          <Link href="/" className="muted">← Back to today</Link>
        </header>
        <SubNav active={active} />

        <section className="admin__section" id="zones">
          {heading("zones")}
          <p className="muted small">
            Same table as your coach sends. Each zone starts one watt above the one before. Tap a swatch to change its colour.
          </p>
          <table className="zones">
            <tbody>
              {zones.map((z, i) => (
                <tr key={z.id}>
                  <td className="zones__swatch">
                    <input type="color" value={draft.zones[i].color} onChange={(e) => setZone(i, { color: e.target.value })} aria-label={`${z.name} colour`} />
                  </td>
                  <td>
                    <input className="zones__name" value={draft.zones[i].name} onChange={(e) => setZone(i, { name: e.target.value })} aria-label={`Zone ${i + 1} name`} />
                  </td>
                  <td className="zones__range">
                    <span className="zones__lo">{z.lo.toLocaleString()}</span>
                    <span className="muted">–</span>
                    <input
                      className="zones__hi" type="number" inputMode="numeric" min={z.lo + 1} value={draft.zones[i].hi}
                      onChange={(e) => setZone(i, { hi: Number(e.target.value) })} aria-label={`${z.name} top, watts`}
                    />
                    <span className="muted">watts</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="admin__ftp">
            <label>
              <span className="admin__sub">Calculate from FTP</span>
              <span className="row">
                <input type="number" inputMode="numeric" placeholder="e.g. 262" value={ftp} onChange={(e) => setFtp(e.target.value)} aria-label="FTP in watts" />
                <button onClick={calculate}>Calculate zones</button>
              </span>
            </label>
            <p className="muted small">
              Zone tops at {ZONE_TOP_PCTS.map((p) => `${Math.round(p * 100)}%`).join(", ")} of FTP, the standard TrainingPeaks power
              zones your coach&apos;s table follows. His numbers match an FTP of about 262 W; adjust any number by hand after.
            </p>
          </div>
        </section>

        <section className="admin__section" id="heart">
          {heading("heart")}
          <p className="muted small">
            Resting to max sets the heart-rate scale on the chart and how hard the current block pulses and the line sparks.
          </p>
          <div className="row admin__hr">
            <label>
              <span className="admin__sub">Resting</span>
              <input type="number" inputMode="numeric" value={draft.hrRest} onChange={(e) => setDraft((d) => ({ ...d, hrRest: Number(e.target.value) }))} aria-label="Resting heart rate, bpm" />
            </label>
            <label>
              <span className="admin__sub">Max</span>
              <input type="number" inputMode="numeric" value={draft.hrMax} onChange={(e) => setDraft((d) => ({ ...d, hrMax: Number(e.target.value) }))} aria-label="Max heart rate, bpm" />
            </label>
            <span className="muted">bpm</span>
          </div>
          <label className="admin__slider">
            <span className="admin__sub">
              Preview heart rate <b className="admin__bpm">{previewBpm} bpm</b>
              <span className="muted small"> · intensity {Math.round(intensity * 100)}%</span>
            </span>
            <input type="range" min={Math.max(40, draft.hrRest - 10)} max={draft.hrMax + 5} value={previewBpm} onChange={(e) => setPreviewBpm(Number(e.target.value))} />
          </label>
        </section>

        <section className="admin__section" id="audio">
          {heading("audio")}
          <div className="admin__cue">
            <div>
              <span className="admin__sub">Countdown</span>
              <p className="muted small">A beep on each of the last seconds of every block, before the change sound.</p>
            </div>
            <div className="row">
              <div className="seg" role="radiogroup" aria-label="Countdown length">
                {COUNTDOWN_OPTIONS.map((n) => (
                  <button key={n} role="radio" aria-checked={draft.audio.countdown === n} onClick={() => setAudio({ countdown: n })}>
                    {n === 0 ? "Off" : `${n} s`}
                  </button>
                ))}
              </div>
              <button className="admin__hear" onClick={() => void hear("countdown")} disabled={draft.audio.countdown === 0}>Play</button>
            </div>
          </div>
          <div className="admin__cue">
            <div>
              <span className="admin__sub">Last minute</span>
              <p className="muted small">Two chimes and &ldquo;One minute left&rdquo; with a minute to go, in every block longer than 90 seconds.</p>
            </div>
            <div className="row">
              <div className="seg" role="radiogroup" aria-label="Last minute cue">
                {[false, true].map((on) => (
                  <button key={String(on)} role="radio" aria-checked={draft.audio.lastMinute === on} onClick={() => setAudio({ lastMinute: on })}>
                    {on ? "On" : "Off"}
                  </button>
                ))}
              </div>
              <button className="admin__hear" onClick={() => void hear("lastMinute")}>Play</button>
            </div>
          </div>
          <div className="admin__cue">
            <div>
              <span className="admin__sub">Second call</span>
              <p className="muted small">A chime and &ldquo;Thirty seconds&rdquo; or &ldquo;Fifteen seconds&rdquo; before the end, in blocks at least twice that long.</p>
            </div>
            <div className="row">
              <div className="seg" role="radiogroup" aria-label="Second call">
                {SECOND_CALL_OPTIONS.map((n) => (
                  <button key={n} role="radio" aria-checked={draft.audio.secondCall === n} onClick={() => setAudio({ secondCall: n })}>
                    {n === 0 ? "Off" : `${n} s`}
                  </button>
                ))}
              </div>
              <button className="admin__hear" onClick={() => void hear("secondCall")} disabled={draft.audio.secondCall === 0}>Play</button>
            </div>
          </div>
        </section>

        <section className="admin__section" id="preview">
          {heading("preview")}
          <div className="admin__preview">{preview(draft.playhead, "profile--admin-main")}</div>
        </section>

        <section className="admin__section" id="line">
          {heading("line")}
          <p className="muted small">The current block pulses; this line marks where you are. Pick one.</p>
          <div className="fx-grid" role="radiogroup" aria-label="Now line style">
            {PLAYHEAD_STYLES.map((s) => (
              <button
                key={s} role="radio" aria-checked={draft.playhead === s}
                className={`fx-card${draft.playhead === s ? " fx-card--on" : ""}`}
                onClick={() => setDraft((d) => ({ ...d, playhead: s }))}
              >
                <div className="fx-card__chart">{preview(s, "profile--admin-card")}</div>
                <span className="fx-card__name">{PLAYHEAD_LABELS[s].name}</span>
                <span className="muted small">{PLAYHEAD_LABELS[s].blurb}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="admin__section admin__save" id="save">
          {heading("save")}
          <label className="admin__token">
            <span className="admin__sub">Access token</span>
            <span className="muted small">Needed to save. Kept on this device.</span>
            <input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="token" />
          </label>
          <div className="row">
            <button className="primary" onClick={save} disabled={status?.kind === "busy"}>Save</button>
            <button onClick={() => { setDraft((d) => ({ ...DEFAULT_SETTINGS, audio: d.audio })); setFtp(""); setStatus({ kind: "ok", text: "Reset to your coach's Oct 2026 zones. Save to keep." }); }}>Reset to coach&apos;s zones</button>
            {dirty && <span className="muted small">Unsaved changes</span>}
          </div>
          {!check.ok && <p className="notice">{check.error}</p>}
          {status && <p className={status.kind === "error" ? "notice" : "muted"}>{status.text}</p>}
        </section>
      </div>
    </main>
  );
}
