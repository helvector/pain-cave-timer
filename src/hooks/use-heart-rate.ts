"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { connectHeartRate, isHeartRateSupported, type HeartRateConnection } from "@/lib/heart-rate";

export type HeartRateStatus = "unsupported" | "idle" | "connecting" | "connected" | "reconnecting" | "error";

export interface HeartRateState {
  status: HeartRateStatus;
  /** Latest reading; undefined until the first notification or when stale. */
  bpm?: number;
  name?: string;
  error?: string;
  connect: () => void;
  disconnect: () => void;
}

const STALE_MS = 8000;

/** Live heart rate from a Bluetooth sensor, shared across screens. */
export function useHeartRate(): HeartRateState {
  const [status, setStatus] = useState<HeartRateStatus>("idle");
  const [bpm, setBpm] = useState<number>();
  const [name, setName] = useState<string>();
  const [error, setError] = useState<string>();
  const conn = useRef<HeartRateConnection | null>(null);
  const staleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Feature detection has to wait for the client; the server never has `navigator`.
    const id = setTimeout(() => { if (!isHeartRateSupported()) setStatus("unsupported"); }, 0);
    return () => clearTimeout(id);
  }, []);

  const connect = useCallback(() => {
    setError(undefined);
    setStatus("connecting");
    void connectHeartRate({
      onRate: (value) => {
        setBpm(value);
        if (staleTimer.current) clearTimeout(staleTimer.current);
        staleTimer.current = setTimeout(() => setBpm(undefined), STALE_MS);
      },
      onStatus: (s, detail) => {
        if (s === "connected") { setStatus("connected"); setName(detail); }
        else if (s === "reconnecting") { setStatus("reconnecting"); setBpm(undefined); }
        else if (s === "disconnected") { setStatus("idle"); setBpm(undefined); if (detail) setError(detail); }
        else setStatus("connecting");
      },
    })
      .then((c) => { conn.current = c; })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        // The user closing the picker is not an error worth shouting about.
        setError(/cancel/i.test(message) ? undefined : message);
        setStatus("idle");
      });
  }, []);

  const disconnect = useCallback(() => {
    conn.current?.disconnect();
    conn.current = null;
    setBpm(undefined);
    setStatus("idle");
  }, []);

  useEffect(() => () => conn.current?.disconnect(), []);

  return { status, bpm, name, error, connect, disconnect };
}
