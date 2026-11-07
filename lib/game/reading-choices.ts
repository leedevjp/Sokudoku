import { entryType, type Word } from "./types";
import { buildReadingIndex, normalizedReading, searchReadings } from "./reading-index";
export { normalizedReading } from "./reading-index";
const cache = new WeakMap<Word[], Map<string, Word[]>>();
const indexes = new WeakMap<Word[], { index: ReturnType<typeof buildReadingIndex>; byReading: Map<string, Word> }>();

/** A reusable nearby-reading pool, with one candidate per distinct reading. */
export function nearbyReadings(word: Word, pool: Word[]): Word[] {
  let catalog = cache.get(pool);
  if (!catalog) { catalog = new Map(); cache.set(pool, catalog); }
  const cached = catalog.get(word.id);
  if (cached) return cached;
  let prepared = indexes.get(pool);
  if (!prepared) {
    const byReading = new Map<string, Word>();
    for (const other of pool) {
      if (entryType(other) !== "word" || other.deleted_at) continue;
      const reading = normalizedReading(other.kana);
      if (reading && !byReading.has(reading)) byReading.set(reading, other);
    }
    prepared = { byReading, index: buildReadingIndex([...byReading.keys()]) };
    indexes.set(pool, prepared);
  }
  const nearest = searchReadings([prepared.index], word.kana).map((reading) => prepared.byReading.get(reading)!);
  catalog.set(word.id, nearest);
  return nearest;
}
