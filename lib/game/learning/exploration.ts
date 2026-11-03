import { entryType, type Word } from "../types";

/** Positive Gaussian mixture. Equal difficulty buckets avoid vocabulary-count bias. */
export function explorationWeights(
  words: Word[],
  ability: number,
  precision: number,
  reviews: number,
) {
  const ordinary = words.filter((word) => entryType(word) === "word");
  const categories = new Set(words.map(entryType));
  const categoryShare = 1 / categories.size;
  const counts = new Map<number, number>();
  for (const word of ordinary)
    counts.set(word.difficulty, (counts.get(word.difficulty) ?? 0) + 1);
  const sigma = Math.max(1.2, Math.min(3.5, 1 + Math.sqrt(1 / precision)));
  const curve = new Map(
    [...counts.keys()].map((d) => [
      d,
      Math.exp(-0.5 * ((d - ability) / sigma) ** 2),
    ]),
  );
  const sum = [...curve.values()].reduce((a, b) => a + b, 0);
  const weighted = ordinary.map((word) => ({
    word,
    weight:
      (reviews < 20
        ? 1 / counts.size
        : 0.1 / counts.size + (0.9 * curve.get(word.difficulty)!) / sum) /
      counts.get(word.difficulty)!,
  }));
  const kanaCounts = new Map<string, number>();
  for (const word of words)
    if (entryType(word) !== "word")
      kanaCounts.set(
        entryType(word),
        (kanaCounts.get(entryType(word)) ?? 0) + 1,
      );
  return [
    ...weighted.map((item) => ({
      ...item,
      weight: item.weight * categoryShare,
    })),
    ...words
      .filter((word) => entryType(word) !== "word")
      .map((word) => ({
        word,
        weight: categoryShare / kanaCounts.get(entryType(word))!,
      })),
  ];
}
