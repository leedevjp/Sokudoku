/** Milliseconds on the presentation clock, independent of answer/FSRS time. */
export const CHARGE_MS = 160;
export const HIT_STOP_MS = 48;
export function chargeProgress(elapsed: number) {
  const t = Math.max(0, Math.min(1, (elapsed - 20) / (CHARGE_MS - 20)));
  return t * t * t;
}
export function knockbackProgress(reaction: number) {
  const t = Math.max(0, Math.min(1, (reaction - HIT_STOP_MS) / 160));
  return 1 - Math.pow(1 - t, 3);
}
