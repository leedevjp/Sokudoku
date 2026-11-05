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
    frames: [0, 0, 0, 1, 2, 3, 0],
    step: 350,
    duration: Infinity,
  },
  hop: { frames: [0, 1, 2, 3], step: 93, duration: 558 },
  happy: { frames: [16, 17, 18, 16], step: 150, duration: 600 },
  encourage: { frames: [15, 15, 0, 15], step: 450, duration: Infinity },
  rest: { frames: [19, 2], step: 1500, duration: Infinity },
  celebrate: {
    frames: [16, 17, 18, 17, 16, 16],
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
