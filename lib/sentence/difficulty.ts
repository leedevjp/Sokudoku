import { parseLevels, selectedDifficulty } from '@/lib/game/selection';

// Same scale as vocabulary: stage 1=0/1, 2=2/3, 3=4/5, 4=6/7, 5=8/9.
// Editorial estimates, not official JLPT certification. Consider the whole passage,
// accepted synonyms AND distractors, grammar, conditionals, and inference burden.
// Do not balance counts by quota or copy the maximum linked word's difficulty.
// The current business-document bank is concentrated in stages 3 and 4; there
// are no genuine beginner/N5 or advanced/N1 passages to label as stages 1 or 5.
export const contextualDifficulties = [
  5,4,5,4,5,4,4,5,5,7,
  6,6,3,6,6,4,5,6,5,6,
  5,4,5,5,4,5,5,5,5,4,
  6,4,5,4,5,6,6,4,5,6,
  5,4,5,4,5,4,6,4,5,6,
  5,4,5,6,4,6,5,5,4,4,
  5,5,5,6,6,6,6,4,7,6,
  6,6,5,5,5,5,6,6,5,6,
  4,4,6,6,5,5,4,5,5,5,
  5,5,5,5,5,5,4,5,5,5,
] as const;

export function sentenceDifficulties(value: string | null): number[] {
  return [...selectedDifficulty(parseLevels(value))].filter(n => n >= 0 && n <= 9);
}
export function sentenceStage(difficulty: number): number {
  return Math.floor(difficulty / 2) + 1;
}
