import { kanaChoices } from "./kana-choices";
import { nearbyReadings, normalizedReading } from "./reading-choices";
import {
  entryType,
  type Word,
  type Stat,
  type Kind,
  type Question,
  type Choice,
} from "./types";
import { trainingKinds, wordsForKinds } from "./selection";

const tokens = (s: string) =>
  s
    .split(/[,，、;·()（）]/)
    .map((x) => x.trim())
    .filter(Boolean);
function overlaps(a: Choice, b: Choice, kind: Kind) {
  return kind === "reading"
    ? normalizedReading(a.kana) === normalizedReading(b.kana)
    : tokens(a.meaning_ko).some((t) => tokens(b.meaning_ko).includes(t));
}
function shuffle<T>(items: T[], rng: () => number) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/** Build choices for a fixed, already selected word/type. No scheduling decisions. */
export function questionFor(
  word: Word,
  kind: Kind,
  pool: Word[],
  rng = Math.random,
): Question | null {
  if (entryType(word) !== "word" && kind !== "meaning") return null;
  if (entryType(word) === "word" && kind === "meaning" && word.meaning_choices) {
    const candidates = shuffle(word.meaning_choices, rng).filter(
      (other) => other.id !== word.id && !overlaps(word, other, kind),
    );
    // Search the small bank rather than letting a greedy overlapping choice
    // hide another valid triple. Each question samples the bank again.
    for (let i = 0; i < candidates.length; i++)
      for (let j = i + 1; j < candidates.length; j++) {
        if (overlaps(candidates[i], candidates[j], kind)) continue;
        for (let k = j + 1; k < candidates.length; k++)
          if (!overlaps(candidates[i], candidates[k], kind) &&
              !overlaps(candidates[j], candidates[k], kind))
            return { word, kind, options: shuffle([word, candidates[i], candidates[j], candidates[k]], rng) };
      }
    return null;
  }
  if (entryType(word) !== "word") {
    const choices = kanaChoices(word, pool, rng);
    if (choices === null) return null;
    if (choices) return { word, kind, options: shuffle(choices, rng) };
    // Non-syllabic kana (ん/っ), legacy labels or incomplete catalogs retain
    // the existing distinct-answer fallback; never fabricate missing entries.
  }
  const options: Word[] = [];
  for (const other of shuffle(kind === "reading" ? nearbyReadings(word, pool) : pool, rng)) {
    if (
      entryType(other) !== entryType(word) ||
      other.id === word.id ||
      overlaps(word, other, kind) ||
      options.some((option) => overlaps(option, other, kind))
    )
      continue;
    options.push(other);
    if (options.length === 3)
      return { word, kind, options: shuffle([word, ...options], rng) };
  }
  return null;
}
export function buildQuestion(
  words: Word[],
  stats: Stat[],
  last?: string,
  rng: () => number = Math.random,
  enabledKinds: Kind[] = trainingKinds,
): Question {
  const pool = wordsForKinds(words, enabledKinds);
  const byId = new Map(stats.map((s) => [s.word_id, s]));

  let candidates = pool
    .filter((w) => pool.length === 1 || w.id !== last)
    .map((word) => {
      const stat = byId.get(word.id);
      return {
        word,
        weight: !stat
          ? 3
          : 1 +
            (1 - (stat.accuracy ?? 0)) * 4 +
            Math.min(2, (stat.average_correct_response_ms ?? 2000) / 2000),
      };
    });
  // Bounded retries keep large vocabularies from producing quadratic per-question work.
  for (let attempt = 0; attempt < Math.min(32, pool.length); attempt++) {
    let n = rng() * candidates.reduce((sum, c) => sum + c.weight, 0);
    let picked = candidates[candidates.length - 1];
    for (const c of candidates) {
      n -= c.weight;
      if (n < 0) {
        picked = c;
        break;
      }
    }
    const word = picked.word;
    const kinds = shuffle<Kind>(
      enabledKinds.filter((kind) => kind === "meaning" || word.has_kanji),
      rng,
    );
    for (const kind of kinds) {
      const question = questionFor(word, kind, pool, rng);
      if (question) return question;
    }
    candidates = candidates.filter((c) => c.word.id !== word.id);
    if (!candidates.length) break;
  }
  throw new Error("NOT_ENOUGH_WORDS");
}
