"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_SETTINGS, resolveZones, validateSettings, type PowerZone, type Settings } from "@/lib/settings";

const CACHE_KEY = "pct.settings";

interface SettingsState {
  settings: Settings;
  zones: PowerZone[];
  /** Replace settings locally (after a save on /admin). */
  apply: (s: Settings) => void;
}

const SettingsContext = createContext<SettingsState>({
  settings: DEFAULT_SETTINGS,
  zones: resolveZones(DEFAULT_SETTINGS.zones),
  apply: () => undefined,
});

function readCache(): Settings | undefined {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = raw ? validateSettings(JSON.parse(raw)) : undefined;
    return parsed?.ok ? parsed.settings : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Loads rider settings once: last-known copy from this device first (so a ride
 * without signal still has your zones), then the server copy.
 */
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const apply = useCallback((s: Settings) => {
    setSettings(s);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(s)); } catch { /* private mode */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cached = readCache();
    void (async () => {
      if (cached && !cancelled) setSettings(cached);
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        const parsed = validateSettings(await res.json());
        if (parsed.ok && !cancelled) apply(parsed.settings);
      } catch {
        /* offline: keep the cached or default settings */
      }
    })();
    return () => { cancelled = true; };
  }, [apply]);

  const value = useMemo(() => ({ settings, zones: resolveZones(settings.zones), apply }), [settings, apply]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsState {
  return useContext(SettingsContext);
}
