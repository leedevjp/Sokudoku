import type { EntryType, Kind } from "@/lib/game/types";
import type { Translate } from "@/lib/dashboard/types";
import styles from "./dashboard.module.css";

export function DashboardFilters({
  entry,
  kind,
  scope,
  t,
  onEntryChange,
  onKindChange,
}: {
  entry: EntryType;
  kind: Kind;
  scope: string;
  t: Translate;
  onEntryChange: (entry: EntryType) => void;
  onKindChange: (kind: Kind) => void;
}) {
  return (
    <section className={styles.card} aria-label={t("表示範囲", "표시 범위")}>
      <div className={styles.tabs}>
        <button
          aria-pressed={entry === "word"}
          onClick={() => onEntryChange("word")}
        >
          {t("単語", "단어")}
        </button>
        <button
          aria-pressed={entry !== "word"}
          onClick={() => onEntryChange("hiragana")}
        >
          {t("かな", "가나")}
        </button>
      </div>
      <div className={styles.pills}>
        {entry === "word"
          ? (["meaning", "reading"] as Kind[]).map((k) => (
              <button
                key={k}
                aria-pressed={kind === k}
                onClick={() => onKindChange(k)}
              >
                {k === "meaning" ? t("意味", "뜻") : t("読み", "읽기")}
              </button>
            ))
          : (["hiragana", "katakana"] as EntryType[]).map((e) => (
              <button
                key={e}
                aria-pressed={entry === e}
                onClick={() => onEntryChange(e)}
              >
                {e === "hiragana"
                  ? t("ひらがな", "히라가나")
                  : t("カタカナ", "가타카나")}
              </button>
            ))}
      </div>
      <p className={styles.caption}>
        {t("以下の数値の対象：", "아래 숫자의 기준: ")}
        {scope}
      </p>
    </section>
  );
}
