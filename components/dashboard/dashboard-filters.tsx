import type { EntryType, Kind } from "@/lib/game/types";
import type { Translate } from "@/lib/dashboard/types";
import styles from "./dashboard-styles";
import css from "./dashboard-companion.module.css";

export function DashboardFilters({
  entry, kind, scope, t, onEntryChange, onKindChange,
}: {
  entry: EntryType;
  kind: Kind;
  scope: string;
  t: Translate;
  onEntryChange: (entry: EntryType) => void;
  onKindChange: (kind: Kind) => void;
}) {
  return (
    <section className={css.inlineFilters} aria-label={t("表示範囲", "표시 범위")}>
      <div className={styles.tabs} role="group" aria-label={t("学習する種類", "학습 종류")}>
        <button type="button" aria-pressed={entry === "word"} onClick={() => onEntryChange("word")}>
          {t("単語", "단어")}
        </button>
        <button type="button" aria-pressed={entry !== "word"} onClick={() => onEntryChange("hiragana")}>
          {t("かな", "가나")}
        </button>
      </div>
      <div className={styles.tabs} role="group" aria-label={t("学習モード", "학습 모드")}>
        {entry === "word"
          ? (["meaning", "reading"] as Kind[]).map(k => (
              <button type="button" key={k} aria-pressed={kind === k} onClick={() => onKindChange(k)}>
                {k === "meaning" ? t("意味", "뜻") : t("読み", "읽기")}
              </button>
            ))
          : (["hiragana", "katakana"] as EntryType[]).map(e => (
              <button type="button" key={e} aria-pressed={entry === e} onClick={() => onEntryChange(e)}>
                {e === "hiragana" ? t("ひらがな", "히라") : t("カタカナ", "가타")}
              </button>
            ))}
      </div>
      <span className={css.visuallyHidden} aria-live="polite">{t("現在の表示範囲：", "현재 학습 기준: ")}{scope}</span>
    </section>
  );
}
