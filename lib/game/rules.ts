import type { Word, Kind } from "./types";

export const INITIAL_HEARTS = 5;
export const FLIGHT_MS = 50;
export const CORRECT_FEEDBACK_MS = 320;
export const MISTAKE_FEEDBACK_MS = 1500;

export const limitFor = (correct: number) =>
  Math.max(2000, 10000 - correct * 200);
export function keyIndex(code: string) {
  const match = /^(?:Digit|Numpad)([1-4])$/.exec(code);
  return match ? Number(match[1]) - 1 : null;
}
export function choiceLabel(
  w: Pick<Word, "kana" | "hanja_reading" | "meaning_ko">,
  kind: Kind,
) {
  return kind === "reading"
    ? w.kana
    : w.hanja_reading
      ? `${w.hanja_reading}(${w.meaning_ko})`
      : w.meaning_ko;
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
