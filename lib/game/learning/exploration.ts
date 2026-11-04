import type { Word } from "../types";

/** Every eligible word has the same probability, regardless of difficulty. */
export function explorationWeights(words: Word[]) {
  return words.map((word) => ({ word, weight: 1 }));
}
