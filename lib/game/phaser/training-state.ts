import type { Question } from "../types";
import type { Phase } from "./types";

/** Shared run clock and generations; async callbacks always read this same state. */
export class TrainingState {
  phase: Phase = "arming";
  beforePause: Phase = "play";
  resizeElapsed = 0;
  afterSettle: Exclude<Phase, "paused" | "settling"> = "play";
  settleUntil = 0;
  settleElapsed = 0;
  question!: Question;
  started = 0;
  pauseAt = 0;
  maxTime = 10000;
  viewGeneration = 0;
  nextGeneration = 0;
  preparingQuestion = false;
  pauseRequested = false;
}
