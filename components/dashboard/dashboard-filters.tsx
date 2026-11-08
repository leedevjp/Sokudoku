"use client";
import { useState } from "react";
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
  const [expanded, setExpanded] = useState(false);
  const toggle = () => setExpanded(value => !value);
  return (
    <section className={css.filterPanel} aria-label={t("表示範囲", "표시 범위")}>
      <button type="button" className={css.filterTrigger} onClick={toggle}
        aria-expanded={expanded} aria-controls="dashboard-filter-options">
        <span className={css.filterLabel}>{t("表示範囲", "학습 기준")}</span>
        <span className={css.filterCurrent}>{scope}</span>
        <span className={css.filterChevron} aria-hidden="true">{expanded ? "⌃" : "⌄"}</span>
      </button>
      {expanded && <div id="dashboard-filter-options" className={css.filterOptions}>
        <div className={styles.tabs}>
          <button aria-pressed={entry === "word"} onClick={() => onEntryChange("word")}>{t("単語", "단어")}</button>
          <button aria-pressed={entry !== "word"} onClick={() => onEntryChange("hiragana")}>{t("かな", "가나")}</button>
        </div>
        <div className={styles.pills}>
          {entry === "word"
            ? (["meaning", "reading"] as Kind[]).map(k => (
              <button key={k} aria-pressed={kind === k} onClick={() => { onKindChange(k); setExpanded(false); }}>
                {k === "meaning" ? t("意味", "뜻") : t("読み", "읽기")}
              </button>
            ))
            : (["hiragana", "katakana"] as EntryType[]).map(e => (
              <button key={e} aria-pressed={entry === e} onClick={() => { onEntryChange(e); setExpanded(false); }}>
                {e === "hiragana" ? t("ひらがな", "히라가나") : t("カタカナ", "가타카나")}
              </button>
            ))}
        </div>
      </div>}
    </section>
  );
}
