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
/** Poses sampled from a shared clock, so pause/resize never queue extra answers. */
export function dodgePose(elapsed: number) {
  const t = Math.max(0, Math.min(1, (elapsed - 75) / 240));
  return {
    x: 125 * (1 - Math.pow(1 - t, 2)),
    y: -72 * Math.sin(Math.PI * t),
    frame: elapsed < 90 ? 0 : elapsed < 275 ? 1 : elapsed < 345 ? 2 : 3,
  };
}
export function stumblePose(elapsed: number) {
  const t = Math.max(0, Math.min(1, (elapsed - 160) / 270));
  return {
    x: 72 * (1 - Math.pow(1 - t, 2)),
    frame:
      elapsed < 210
        ? 3
        : elapsed < 280
          ? 4
          : elapsed < 350
            ? 5
            : elapsed < 750
              ? 6
              : 7,
  };
}
