/** Visual choices only; never affects question selection, scoring or FSRS. */
export const SPELL_HIT_MS = 160;
export const SPELL_HIT_STOP_MS = 48;
export function magicEncounter(key: string) {
  let hash = 2166136261;
  for (const c of key) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return { monster: (hash >>> 0) % 4, element: (hash >>> 8) % 4 };
}
export function magicCastFrame(t: number) {
  return t < 60 ? 4 : t < 110 ? 5 : t < 208 ? 6 : 7;
}
export function magicFallFrame(t: number) {
  const thresholds = [220, 290, 460, 750, 950, 1100, 1250];
  const index = thresholds.findIndex((end) => t < end);
  return index < 0 ? 15 : 8 + index;
}
export function magicImpactFrame(age: number) {
  return age < 0 || age >= 290
    ? null
    : age < 48
      ? 2
      : age < 125
        ? 3
        : age < 205
          ? 4
          : 5;
}
