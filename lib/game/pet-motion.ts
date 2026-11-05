/** Visual-only companion state. Never changes questions, scoring or FSRS. */
export type PetMotion =
  | "idle"
  | "hop"
  | "happy"
  | "encourage"
  | "rest"
  | "celebrate";
export const PET_CLIPS: Record<
  PetMotion,
  { frames: readonly number[]; step: number; duration: number }
> = {
  idle: {
    frames: [0, 1, 2, 3, 4, 5],
    step: 350,
    duration: Infinity,
  },
  hop: { frames: [6, 7, 8, 9, 10, 11], step: 93, duration: 558 },
  happy: { frames: [30, 31, 32, 33, 34, 35], step: 100, duration: 600 },
  encourage: { frames: [29, 30, 35, 30], step: 450, duration: Infinity },
  rest: { frames: [28, 29], step: 1500, duration: Infinity },
  celebrate: {
    frames: [30, 31, 32, 33, 34, 35, 35, 35],
    step: 180,
    duration: Infinity,
  },
};
export function petFrame(motion: PetMotion, elapsed: number, reduced = false) {
  const clip = PET_CLIPS[motion];
  return clip.frames[
    reduced
      ? 0
      : Math.floor(Math.max(0, elapsed) / clip.step) % clip.frames.length
  ];
}
export class PetMotionState {
  motion: PetMotion = "idle";
  elapsed = 0;
  play(motion: PetMotion) {
    this.motion = motion;
    this.elapsed = 0;
  }
  tick(delta: number, paused = false) {
    if (paused) return;
    this.elapsed += Math.max(0, delta);
    if (this.elapsed >= PET_CLIPS[this.motion].duration) this.play("idle");
  }
}
