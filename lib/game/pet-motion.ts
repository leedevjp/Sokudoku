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
    frames: [0, 0, 0, 0, 1, 0, 0, 2, 3, 0],
    step: 350,
    duration: Infinity,
  },
  hop: { frames: [4, 5, 6, 7], step: 140, duration: 560 },
  happy: { frames: [8, 9, 10, 11], step: 150, duration: 600 },
  encourage: { frames: [12, 13, 13, 12], step: 450, duration: Infinity },
  rest: { frames: [14, 15], step: 1500, duration: Infinity },
  celebrate: {
    frames: [8, 9, 10, 11, 11, 11, 11, 11],
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
