import type { Word, Stat, Answer, Kind } from "../types";
import type { Preferences } from "../preferences";

export type TrainingOptions = {
  words: Word[];
  stats: Stat[];
  kinds?: Kind[];
  preferences: Preferences;
  onPreferences: (p: Preferences) => void;
  onAnswer: (a: Answer) => void;
  onFinish: () => Promise<boolean>;
  onRetry: () => Promise<{ words: Word[]; stats: Stat[] }>;
  onExit: () => void;
  preview?: boolean;
};
export type Phase =
  | "arming"
  | "play"
  | "flight"
  | "feedback"
  | "paused"
  | "end";
