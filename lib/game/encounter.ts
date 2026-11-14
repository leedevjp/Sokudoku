import type { Lang } from "./preferences";

export function encounterLabel(count: number, lang: Lang) {
  return count === 1
    ? lang === "jp" ? "初めての出会い" : "첫 만남"
    : lang === "jp" ? `${count}回目の出会い` : `${count}번째 만남`;
}
