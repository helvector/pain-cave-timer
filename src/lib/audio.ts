import type { Cue } from "./workout/types";

/**
 * Audio cues synthesised with the Web Audio API so there are no asset files
 * and nothing to preload. Work and recovery transitions sound different on
 * purpose: work is two rising beeps, recovery is one low tone. The
 * last-minute cue adds a spoken phrase (Web Speech) after its chime.
 */
export class Cues {
  private ctx?: AudioContext;

  /** Must be called from a user gesture (the Start tap) to unlock audio. */
  async unlock(): Promise<void> {
    if (typeof window === "undefined") return;
    if (!this.ctx) this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    // iOS only lets speech play after a gesture has spoken once; a silent utterance does it.
    try {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis?.speak(u);
    } catch { /* no speech synthesis */ }
  }

  play(cue: Cue | "finish" | "tick" | "lastMinute"): void {
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
      case "lastMinute":
        // Two soft high notes, then the words, so it can't be mistaken for a block change.
        this.beeps([[1320, 0.1], [1320, 0.1]], 0.08, 0.6);
        this.say("One minute left", 0.45);
        break;
    }
  }

  /** Speak a short phrase after `delaySec`. The chime before it still plays where speech isn't available. */
  private say(text: string, delaySec: number): void {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    setTimeout(() => {
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.05;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      } catch { /* no speech synthesis */ }
    }, delaySec * 1000);
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
