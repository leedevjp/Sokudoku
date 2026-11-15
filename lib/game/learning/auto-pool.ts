import type { Kind, Word } from "../types";
import { cardKey, wordKey } from "./types";

export type AutoEntry = { word: Word; kind: Kind; key: string; wordKey: string };
const pools = new WeakMap<Word[], Map<string, AutoEntry[]>>();

/** Identity keys are static for one catalog. Eligibility and weights stay live. */
export function* autoPool(words: Word[], kinds: Kind[], cooperative: boolean): Generator<null, AutoEntry[], void> {
  let scopes = pools.get(words);
  if (!scopes) { scopes = new Map(); pools.set(words, scopes); }
  const key = kinds.join(","), cached = scopes.get(key);
  if (cached) return cached;
  const entries: AutoEntry[] = [];
  for (const [i, word] of words.entries()) {
    const id = wordKey(word.source, word.id);
    for (const kind of kinds) entries.push({ word, kind, wordKey: id, key: cardKey(word.source, word.id, kind) });
    if (cooperative && i % 256 === 255) yield null;
  }
  scopes.set(key, entries);
  return entries;
}
