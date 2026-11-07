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

export function idleBattlePose(elapsed: number, reduced: boolean) {
  if (reduced) return { mageX: 0, mageY: 0, monsterX: 0, monsterY: 0 };
  const cycle = (elapsed % 2400) / 2400;
  const hop = cycle < .24 ? Math.sin(cycle / .24 * Math.PI) : 0;
  return {
    mageX: Math.sin(elapsed / 900) * 2,
    mageY: -Math.abs(Math.sin(elapsed / 650)) * 1.5,
    monsterX: Math.sin(elapsed / 750) * 7,
    monsterY: -hop * 9,
  };
}
