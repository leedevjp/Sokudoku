import { entryType, type Word } from "./types";

// Only metadata and generation rules live here, never authored answer sets.
const YOON = new Set([2, 12, 17]); // ㅑ ㅛ ㅠ
const basicVowels = new Set([0, 5, 20, 8, 13]); // ㅏ ㅔ ㅣ ㅗ ㅜ
function sound(word: Word) {
  const label = word.meaning_ko.trim().normalize("NFC");
  if (!/^[가-힣]$/.test(label)) return null;
  const value = label.charCodeAt(0) - 0xac00;
  if (value % 28 !== 0) return null;
  const vowel = Math.floor(value / 28) % 21;
  // Balance the vowels actually displayed, without merging Korean spellings.
  const column = vowel;
  const group = YOON.has(vowel) ? "yoon" : basicVowels.has(column) ? "basic" : null;
  return group ? { row: Math.floor(value / 588), column, group } : null;
}

// Weak ownership limits history to the in-memory catalog/session lifetime.
const recent = new WeakMap<Word[], Map<string, string[]>>();
export function kanaChoices(word: Word, pool: Word[], rng: () => number): Word[] | null | undefined {
  const target = sound(word);
  if (!target) return undefined;
  const type = entryType(word);
  const cells = new Map<string, Word[]>();
  for (const item of pool) {
    if (entryType(item) !== type) continue;
    const info = sound(item);
    if (!info || info.group !== target.group) continue;
    const key = info.row + ":" + info.column;
    const values = cells.get(key) ?? [];
    values.push(item);
    cells.set(key, values);
  }
  // Enumerate available opposite corners; never invent pronunciations or IDs.
  const candidates: { key: string; sides: Word[][] }[] = [];
  for (const [key, opposite] of cells) {
    const [row, column] = key.split(":").map(Number);
    if (row === target.row || column === target.column) continue;
    const sameRow = cells.get(target.row + ":" + column);
    const sameColumn = cells.get(row + ":" + target.column);
    if (sameRow && sameColumn) candidates.push({ key, sides: [sameRow, sameColumn, opposite] });
  }
  if (!candidates.length) return null;
  let history = recent.get(pool);
  if (!history) { history = new Map(); recent.set(pool, history); }
  const previous = history.get(word.id) ?? [];
  let available = candidates.filter(c => !previous.includes(c.key));
  // When all combinations have been seen, reuse the least recent first.
  if (!available.length) {
    const oldest = Math.min(...candidates.map(c => previous.indexOf(c.key)));
    available = candidates.filter(c => previous.indexOf(c.key) === oldest);
  }
  const selected = available[Math.floor(rng() * available.length)];
  const options = [word, ...selected.sides.map(items => items[Math.floor(rng() * items.length)])];
  if (new Set(options.map(w => w.meaning_ko.trim())).size !== 4) return null;
  history.set(word.id, [...previous.filter(key => key !== selected.key), selected.key].slice(-12));
  return options;
}
