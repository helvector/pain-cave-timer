import type { Cue } from "./workout/types";

/**
 * Audio cues synthesised with the Web Audio API so there are no asset files
 * and nothing to preload. Work and recovery transitions sound different on
 * purpose: work is two rising beeps, recovery is one low tone.
 */
export class Cues {
  private ctx?: AudioContext;

  /** Must be called from a user gesture (the Start tap) to unlock audio. */
  async unlock(): Promise<void> {
    if (typeof window === "undefined") return;
    if (!this.ctx) this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  play(cue: Cue | "finish" | "tick"): void {
    switch (cue) {
      case "start":
        this.beeps([[880, 0.12], [880, 0.12], [880, 0.12]], 0.2);
        break;
      case "work":
        this.beeps([[660, 0.15], [990, 0.3]], 0.18);
        break;
      case "recovery":
        this.beeps([[440, 0.45]], 0);
        break;
      case "finish":
        this.beeps([[990, 0.25], [880, 0.25], [660, 0.6]], 0.3);
        break;
      case "tick":
        this.beeps([[1200, 0.05]], 0, 0.5);
        break;
    }
  }

  private beeps(notes: Array<[hz: number, sec: number]>, gap: number, volume = 1): void {
    const ctx = this.ctx;
    if (!ctx) return;
    let t = ctx.currentTime + 0.01;
    for (const [hz, sec] of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = hz;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.4 * volume, t + 0.01);
      gain.gain.setValueAtTime(0.4 * volume, t + sec - 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + sec);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + sec);
      t += sec + gap;
    }
  }
}
