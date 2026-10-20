"use client";

import { MotionConfig } from "motion/react";
import { SettingsProvider } from "./SettingsProvider";

/** Honour the OS "reduce motion" setting for every animation, and load rider settings. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <SettingsProvider>{children}</SettingsProvider>
    </MotionConfig>
  );
}
