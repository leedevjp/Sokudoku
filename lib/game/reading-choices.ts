import { entryType, type Word } from "./types";

export const normalizedReading = (kana: string) => kana.normalize("NFKC")
  .replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
  .replace(/\s+/g, "");

function distance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++)
      next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (a[i] === b[j] ? 0 : 1)));
    row = next;
  }
  return row[b.length];
}
const cache = new WeakMap<Word[], Map<string, Word[]>>();

/** A reusable nearby-reading pool, with one candidate per distinct reading. */
export function nearbyReadings(word: Word, pool: Word[]): Word[] {
  let catalog = cache.get(pool);
  if (!catalog) { catalog = new Map(); cache.set(pool, catalog); }
  const cached = catalog.get(word.id);
  if (cached) return cached;
  const target = normalizedReading(word.kana), distinct = new Map<string, Word>();
  for (const other of pool) {
    if (entryType(other) !== "word" || other.id === word.id) continue;
    const reading = normalizedReading(other.kana);
    if (reading && reading !== target && !distinct.has(reading)) distinct.set(reading, other);
  }
  const nearest = [...distinct].map(([reading, other]) => ({
    other, score: distance(target, reading) + Math.abs(target.length - reading.length) * 0.25,
  })).sort((a, b) => a.score - b.score).slice(0, 20).map((x) => x.other);
  catalog.set(word.id, nearest);
  return nearest;
}
