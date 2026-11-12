import type { NotebookWord } from "./types";
export type NotebookQuery = {
  search: string;
  membership: "all" | "registered" | "unregistered";
  difficulty: string;
  sort: "recent" | "oldest" | "reading" | "easy" | "hard";
};
export const defaultNotebookQuery: NotebookQuery = { search: "", membership: "all", difficulty: "all", sort: "recent" };
const normalize = (text: string) => text.normalize("NFKC").toLowerCase().replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
export function queryNotebook(words: NotebookWord[], query: NotebookQuery): NotebookWord[] {
  const tokens = normalize(query.search).trim().split(/\s+/u).filter(Boolean);
  const result = words.filter(word => {
    const registered = word.source === "personal" || !!word.in_personal;
    if (query.membership === "registered" && !registered) return false;
    if (query.membership === "unregistered" && registered) return false;
    if (query.difficulty !== "all" && word.difficulty !== Number(query.difficulty)) return false;
    const haystack = normalize([word.term, word.kana, word.meaning_ko, word.hanja_reading, word.note].filter(Boolean).join(" "));
    return tokens.every(token => haystack.includes(token));
  });
  return result.sort((a, b) => {
    let difference = 0;
    if (query.sort === "reading") difference = a.kana.localeCompare(b.kana, "ja");
    else if (query.sort === "easy") difference = a.difficulty - b.difficulty;
    else if (query.sort === "hard") difference = b.difficulty - a.difficulty;
    else difference = (Date.parse(a.last_incorrect_at) - Date.parse(b.last_incorrect_at)) * (query.sort === "recent" ? -1 : 1);
    return difference || a.term.localeCompare(b.term, "ja") || `${a.source}:${a.id}`.localeCompare(`${b.source}:${b.id}`);
  });
}
