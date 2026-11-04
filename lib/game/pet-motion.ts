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

/** Sub-frame animation keeps the original atlas intact. Values are size-relative. */
export function petPose(motion: PetMotion, elapsed: number, reduced = false) {
  const frame = petFrame(motion, elapsed, reduced);
  if (reduced)
    return {
      frame,
      next: frame,
      mix: 0,
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
    };
  const t = Math.max(0, elapsed),
    clip = PET_CLIPS[motion];
  const index = Math.floor(t / clip.step) % clip.frames.length;
  const next = clip.frames[(index + 1) % clip.frames.length];
  const blendWindow = motion === "idle" ? 35 : 65;
  const fraction = Math.max(
    0,
    ((t % clip.step) - (clip.step - blendWindow)) / blendWindow,
  );
  const mix =
    next === frame || ["hop", "happy", "celebrate"].includes(motion)
      ? 0
      : fraction * fraction * (3 - 2 * fraction);
  const breath = (1 - Math.cos((t * Math.PI * 2) / 2200)) / 2;
  const sway = Math.sin((t * Math.PI * 2) / 3800);
  const jumping =
    motion === "hop" || motion === "happy" || motion === "celebrate";
  const jumpDuration = clip.step * 4;
  const jumpTime =
    motion === "celebrate" ? t % (clip.step * clip.frames.length) : t;
  const jump =
    jumping && jumpTime < jumpDuration
      ? Math.pow(Math.sin((jumpTime / jumpDuration) * Math.PI), 2)
      : 0;
  return {
    frame,
    next,
    mix,
    x: motion === "rest" ? 0 : sway * 0.012,
    y: -jump * 0.035,
    scaleX: 1 + breath * 0.012 - jump * 0.025,
    scaleY: 1 + breath * 0.035 + jump * 0.025,
    angle: motion === "rest" ? 0 : sway * 1.6,
  };
}
