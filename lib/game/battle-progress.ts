import type { Result } from "./types";

/** Presentation progress only: no extra damage, time, hearts or learning credit. */
export class BattleProgress {
  combo = 0;
  bestCombo = 0;
  reset() { this.combo = 0; this.bestCombo = 0; }
  record(result: Result) {
    this.combo = result === "correct" ? this.combo + 1 : 0;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
  }
}
export function comboTier(combo: number) {
  return combo >= 10 ? 3 : combo >= 5 ? 2 : combo >= 3 ? 1 : 0;
}
export function battleRegion(correct: number) { return Math.floor(correct / 10) % 3; }

/** A brief blink followed by a long rest. Actor transforms never animate at idle. */
export function battleIdleFrame(elapsed: number, reduced: boolean) {
  if (reduced) return 0;
  const phase = Math.max(0, elapsed) % 4200;
  if (phase < 2400) return 0;
  return Math.min(7, 1 + Math.floor((phase - 2400) / 150));
}
