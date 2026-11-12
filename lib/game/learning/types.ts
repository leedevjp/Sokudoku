import type { DefaultSchedulerCard } from "ts-fsrs";
import type { Answer, Kind } from "../types";

export const LEARNING_VERSION = "ts-fsrs@6.0.0/FSRS-7/again-good-kana-v2";
export type TrainingMode = "exploration" | "review" | "exam" | "auto";
export const trainingModes: TrainingMode[] = ["auto", "exploration", "review", "exam"];
export const defaultTrainingModes: TrainingMode[] = ["exploration", "review"];
export function parseModes(value: string | null): TrainingMode[] {
  return value === null
    ? [...defaultTrainingModes]
    : value.split(",").includes("auto")
      ? ["auto"]
    : value.split(",").includes("exam")
      ? ["exam"]
      : defaultTrainingModes.filter((mode) => value.split(",").includes(mode));
}
export function toggleTrainingMode(
  current: TrainingMode[],
  mode: TrainingMode,
): TrainingMode[] {
  if (mode === "auto") return current.includes("auto") ? [] : ["auto"];
  if (mode === "exam") return current.includes("exam") ? [] : ["exam"];
  return defaultTrainingModes.filter((item) =>
    item === mode ? !current.includes(item) : current.includes(item),
  );
}
export type StoredCard = Omit<
  DefaultSchedulerCard,
  "dueAt" | "lastReviewAt"
> & {
  dueAt: string;
  lastReviewAt: string | null;
};
export type LearningWord = {
  word_id: string | null;
  personal_word_id: string | null;
  source: "word" | "personal";
  word_ref: string;
  question_type: Kind;
  card: StoredCard;
  due_at: string;
  last_review_at: string;
  last_result: Answer["result"];
  last_answer_id: string;
  model_version: string;
};
export type Learner = {
  ability: number;
  precision: number;
  review_count: number;
  ability_count: number;
  last_answered_at: string | null;
  last_answer_id: string | null;
  revision: number;
  model_version: string;
};
export type LearningSnapshot = {
  learner: Learner | null;
  words: LearningWord[];
};
export const emptyLearning = (): LearningSnapshot => ({
  learner: null,
  words: [],
});
export type LearningEvent = Pick<
  Answer,
  "id" | "word_id" | "question_type" | "result" | "answered_at"
> & {
  source: "word" | "personal";
  difficulty: number;
};
export const wordKey = (source: string | undefined, id: string) =>
  `${source === "personal" ? "personal" : "word"}:${id}`;
export const cardKey = (source: string | undefined, id: string, kind: Kind) =>
  `${wordKey(source, id)}:${kind}`;
