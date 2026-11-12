import { vocabularyLevels } from "@/lib/game/selection";
import type { NotebookQuery } from "@/lib/notebook/query";
import styles from "./personal-actions.module.css";
export function NotebookControls({ query, onChange, count, total, disabled, t }: {
  query: NotebookQuery; onChange: (patch: Partial<NotebookQuery>) => void;
  count: number; total: number; disabled: boolean; t: (jp: string, kr: string) => string;
}) {
  return <div className={styles.controls}>
    <div className={styles.searchBox}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>
      <input type="search" value={query.search} disabled={disabled} aria-label={t("ノートを検索", "오답노트 검색")} placeholder={t("単語・読み・意味で検索", "단어·읽기·뜻 검색")} onChange={e => onChange({ search: e.target.value })} />
      <output aria-label={t("検索結果", "검색 결과")} aria-live="polite">{count}<span>/{total}</span></output>
    </div>
    <div className={styles.filters}>
      <select disabled={disabled} aria-label={t("Pへの追加状況", "P 추가 여부")} value={query.membership} onChange={e => onChange({ membership: e.target.value as NotebookQuery["membership"] })}>
        <option value="all">{t("すべての単語", "모든 단어")}</option><option value="registered">{t("Pに追加済み", "P에 추가함")}</option><option value="unregistered">{t("Pに未追加", "P에 미추가")}</option>
      </select>
      <select disabled={disabled} aria-label={t("ステージ", "단계 필터")} value={query.stage} onChange={e => onChange({ stage: e.target.value as NotebookQuery["stage"] })}>
        <option value="all">{t("全ステージ", "전체 단계")}</option>
        <option value="H">{t("ひらがな", "히라가나")}</option><option value="K">{t("カタカナ", "가타카나")}</option>
        {vocabularyLevels.map(level => <option key={level} value={level}>{level === "P" ? t("P・個人単語", "P · 개인 단어") : t(`ステージ${level}`, `${level}단계`)}</option>)}
      </select>
      <select disabled={disabled} aria-label={t("並び順", "정렬 순서")} value={query.sort} onChange={e => onChange({ sort: e.target.value as NotebookQuery["sort"] })}>
        <option value="recent">{t("新しい順", "최근 오답순")}</option><option value="oldest">{t("古い順", "오래된순")}</option><option value="reading">{t("五十音順", "읽기순")}</option><option value="easy">{t("易しい順", "쉬운순")}</option><option value="hard">{t("難しい順", "어려운순")}</option>
      </select>
    </div>
  </div>;
}
