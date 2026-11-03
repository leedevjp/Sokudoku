import type { Phase } from "./types";

/** A viewport change is not a pause request. Preserve elapsed time across redraws. */
export function resizeProgress(
  state: {
    phase: Phase;
    beforePause: Phase;
    afterSettle: Phase;
    started: number;
    pauseAt: number;
    resizeElapsed: number;
    settleElapsed: number;
  },
  now: number,
  limit: number,
) {
  const paused = state.phase === "paused";
  const previous = paused ? state.beforePause : state.phase;
  const active = previous === "settling" ? state.afterSettle : previous;
  const resolved = active === "flight" || active === "feedback";
  let elapsed = state.resizeElapsed;
  if (previous === "settling") elapsed = state.settleElapsed;
  else if (previous !== "arming")
    elapsed = (paused ? state.pauseAt : now) - state.started;
  return {
    paused,
    resolved,
    elapsed: resolved ? 0 : Math.max(0, Math.min(elapsed, limit)),
  };
}
