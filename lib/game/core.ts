import type { Tables } from "@/lib/supabase/database.types";
export type Word = Tables<"word"> & { source?: "personal" };
export type Stat = Tables<"word_recent_stat">;
export type Kind = "meaning" | "reading";
export type Result = "correct" | "incorrect" | "timeout";
export type Answer = {
  source?: "word" | "personal";
  selected_source?: "word" | "personal";
  id: string;
  word_id: string;
  question_type: Kind;
  selected_word_id: string | null;
  result: Result;
  response_ms: number;
  time_limit_ms: number;
  answered_at: string;
};
export type Question = { word: Word; kind: Kind; options: Word[] };
export const limitFor = (correct: number) =>
  Math.max(2000, 10000 - correct * 200);
export function keyIndex(code: string) {
  const match = /^(?:Digit|Numpad)([1-4])$/.exec(code);
  return match ? Number(match[1]) - 1 : null;
}
export function choiceLabel(w: Word, kind: Kind) {
  return kind === "reading"
    ? w.kana
    : w.hanja_reading
      ? `${w.hanja_reading}(${w.meaning_ko})`
      : w.meaning_ko;
}
const tokens = (s: string) =>
  s
    .split(/[,，、;·()（）]/)
    .map((x) => x.trim())
    .filter(Boolean);
function overlaps(a: Word, b: Word, kind: Kind) {
  return kind === "reading"
    ? a.kana === b.kana
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
export function buildQuestion(
  words: Word[],
  stats: Stat[],
  last?: string,
  rng: () => number = Math.random,
): Question {
  const pool = words.filter((w) => !w.deleted_at);
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
      word.has_kanji ? ["meaning", "reading"] : ["meaning"],
      rng,
    );
    for (const kind of kinds) {
      const options: Word[] = [];
      for (const other of shuffle(pool, rng)) {
        if (
          other.id === word.id ||
          overlaps(word, other, kind) ||
          options.some((x) => overlaps(x, other, kind))
        )
          continue;
        options.push(other);
        if (options.length === 3) break;
      }
      if (options.length === 3)
        return { word, kind, options: shuffle([word, ...options], rng) };
    }
    candidates = candidates.filter((c) => c.word.id !== word.id);
    if (!candidates.length) break;
  }
  throw new Error("NOT_ENOUGH_WORDS");
}
// A down event atomically claims a question; held/repeated input cannot claim it again.
export class AnswerGate {
  source: string | null = null;
  index: number | null = null;
  locked = true;
  open() {
    this.source = null;
    this.index = null;
    this.locked = false;
  }
  claim(source: string, index: number) {
    if (this.locked) return false;
    this.source = source;
    this.index = index;
    this.locked = true;
    return true;
  }
  cancel() {
    this.source = null;
    this.index = null;
  }
  close() {
    this.cancel();
    this.locked = true;
  }
}
