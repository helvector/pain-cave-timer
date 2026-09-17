"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Workout } from "@/lib/workout/types";
import { Confirm } from "./Confirm";
import { Ride } from "./Ride";
import { clock } from "@/lib/timer";
import { Fade } from "@/components/animate-ui/primitives/effects/fade";
import { useHeartRate } from "@/hooks/use-heart-rate";

const TOKEN_KEY = "pct.token";

interface ApiResult {
  date: string;
  workout?: Workout;
  days: Workout[];
  warnings: string[];
  error?: string;
  detail?: string;
  demo?: boolean;
}

type Phase =
  | { name: "loading" }
  | { name: "token"; message?: string }
  | { name: "error"; message: string }
  | { name: "confirm"; result: ApiResult; selected: Workout }
  | { name: "ride"; workout: Workout }
  | { name: "done"; workout: Workout; elapsedSec: number };

function readToken(): string {
  try { return localStorage.getItem(TOKEN_KEY) ?? ""; } catch { return ""; }
}

export function App() {
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [tokenInput, setTokenInput] = useState("");
  const heartRate = useHeartRate();


  const params = useMemo(() => (typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search)), []);
  const demo = params.get("demo") === "1";
  // Demo only: ?bpm=142 simulates a connected strap so the pulse can be previewed.
  const demoBpm = demo && params.get("bpm") ? Number(params.get("bpm")) : undefined;
  const [simBpm, setSimBpm] = useState<number>();
  useEffect(() => {
    if (!demoBpm) return;
    const id = setInterval(() => setSimBpm(demoBpm + Math.round((Math.random() - 0.5) * 6)), 2000);
    return () => clearInterval(id);
  }, [demoBpm]);
  const liveBpm = demoBpm ? (simBpm ?? demoBpm) : heartRate.status === "connected" ? heartRate.bpm : undefined;

  const load = useCallback(async () => {
    const token = readToken();
    if (!token && !demo) {
      setPhase({ name: "token" });
      return;
    }
    const qs = new URLSearchParams();
    if (params.get("date")) qs.set("date", params.get("date")!);
    if (demo) qs.set("demo", "1");
    try {
      const res = await fetch(`/api/workout?${qs}`, { headers: demo ? {} : { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const body = (await res.json()) as ApiResult;
      if (res.status === 401) {
        setPhase({ name: "token", message: "That token was rejected." });
        return;
      }
      if (!res.ok && !body.days?.length) {
        setPhase({ name: "error", message: body.detail ? `${body.error}: ${body.detail}` : body.error ?? `HTTP ${res.status}` });
        return;
      }
      const selected = body.workout ?? body.days.find((d) => !d.isRestDay) ?? body.days[0];
      if (!selected) {
        setPhase({ name: "error", message: body.warnings.join(" ") || "No workout found." });
        return;
      }
      setPhase({ name: "confirm", result: body, selected });
    } catch (err) {
      setPhase({ name: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, [demo, params]);

  const reload = useCallback(() => {
    setPhase({ name: "loading" });
    void load();
  }, [load]);

  useEffect(() => {
    // Kick off the first load from a callback rather than the effect body itself.
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  if (phase.name === "loading") {
    return <main className="screen center"><p className="muted">Loading workout…</p></main>;
  }

  if (phase.name === "token") {
    return (
      <main className="screen center">
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            try { localStorage.setItem(TOKEN_KEY, tokenInput.trim()); } catch { /* private mode */ }
            reload();
          }}
        >
          <h1>Access token</h1>
          <p className="muted">{phase.message ?? "Paste the APP_TOKEN from the Vercel project. It is kept on this device only."}</p>
          <input value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="token" />
          <button className="primary" type="submit" disabled={!tokenInput.trim()}>Continue</button>
        </form>
      </main>
    );
  }

  if (phase.name === "error") {
    return (
      <main className="screen center">
        <div className="stack">
          <h1>Couldn&apos;t load the workout</h1>
          <p className="notice">{phase.message}</p>
          <div className="row">
            <button onClick={reload}>Try again</button>
            <button onClick={() => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } setPhase({ name: "token" }); }}>Change token</button>
          </div>
        </div>
      </main>
    );
  }

  if (phase.name === "confirm") {
    return (
      <Confirm
        result={phase.result}
        selected={phase.selected}
        onSelect={(w) => setPhase({ name: "confirm", result: phase.result, selected: w })}
        onStart={() => setPhase({ name: "ride", workout: phase.selected })}
        onReload={reload}
        heartRate={heartRate}
      />
    );
  }

  if (phase.name === "ride") {
    return (
      <Ride
        workout={phase.workout}
        bpm={liveBpm}
        onDone={(elapsedSec) => setPhase({ name: "done", workout: phase.workout, elapsedSec })}
        onExit={reload}
      />
    );
  }

  return (
    <main className="screen center done">
      <Fade className="stack" style={{ alignItems: "center" }} initialOpacity={0} transition={{ duration: 0.4 }}>
        <p className="muted">Done</p>
        <div className="time">{clock(phase.elapsedSec)}</div>
        <h1>{phase.workout.title}</h1>
        <button className="primary" onClick={reload}>Back to today</button>
      </Fade>
    </main>
  );
}
