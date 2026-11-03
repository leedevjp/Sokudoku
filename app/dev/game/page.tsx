import { notFound } from "next/navigation";
import GameHost from "@/app/game/game-host";
import type { Word } from "@/lib/game/types";
export default function Preview() {
  if (process.env.NODE_ENV !== "development") notFound();
  const rows = [
    ["秋", "あき", "추", "가을"],
    ["朝", "あさ", "조", "아침"],
    ["足", "あし", "족", "발, 다리"],
    ["頭", "あたま", "두", "머리"],
    ["兄", "あに", "형", "형, 오빠"],
    ["明日", "あした", "명일", "내일"],
    ["間", "あいだ", "간", "사이, 동안"],
    ["後", "あと", "후", "뒤, 이후"],
  ];
  const words: Word[] = rows.map((r, i) => ({
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    term: r[0],
    kana: r[1],
    hanja_reading: r[2],
    meaning_ko: r[3],
    has_kanji: true,
    difficulty: 0,
    note: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    deleted_at: null,
  }));
  return <GameHost previewWords={words} />;
}
