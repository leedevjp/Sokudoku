import type { Word, Stat, Answer, Kind } from "../types";
import type { Preferences } from "../preferences";
import type { TrainingPlanner } from "../learning/planner";

export type TrainingOptions = {
  words: Word[];
  stats: Stat[];
  kinds?: Kind[];
  planner: TrainingPlanner;
  preferences: Preferences;
  onPreferences: (p: Preferences) => void;
  onAnswer: (a: Answer) => void;
  onFinish: () => Promise<boolean>;
  onRetry: () => Promise<{
    words: Word[];
    stats: Stat[];
    planner?: TrainingPlanner;
  }>;
  onExit: () => void;
  onReady?: () => void;
  onError?: (error: unknown) => void;
  preview?: boolean;
};
export type Phase =
  | "arming"
  | "settling"
  | "play"
  | "flight"
  | "feedback"
  | "correction"
  | "paused"
  | "end";
