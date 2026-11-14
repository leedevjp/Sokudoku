import { FilterSelect } from "@/components/ui/filter-select";
import { StageFilter } from "@/components/ui/stage-filter";
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
      <FilterSelect<NotebookQuery["membership"]> disabled={disabled} title={t("Pへの追加状況", "내 단어장 추가 여부")}
        hint={t("ひとつ選ぶと、すぐに反映されます。", "한 가지를 선택하면 바로 적용돼요.")}
        value={query.membership} onChange={membership => onChange({ membership })} options={[
          { value: "all", label: t("すべての単語", "모든 단어") },
          { value: "registered", label: t("Pに追加済み", "P에 추가함"), detail: t("マイ単語帳にある単語", "내 단어장에 담은 단어") },
          { value: "unregistered", label: t("Pに未追加", "P에 미추가"), detail: t("まだマイ単語帳にない単語", "아직 내 단어장에 담지 않은 단어") },
        ]} />
      <StageFilter value={query.stage} onChange={stage => onChange({ stage: stage as NotebookQuery["stage"] })} disabled={disabled} t={t} />
      <FilterSelect<NotebookQuery["sort"]> disabled={disabled} title={t("並び順", "정렬 순서")}
        hint={t("ひとつ選ぶと、すぐに反映されます。", "한 가지를 선택하면 바로 적용돼요.")}
        value={query.sort} onChange={sort => onChange({ sort })} options={[
          { value: "recent", label: t("新しい順", "최근 오답순") },
          { value: "oldest", label: t("古い順", "오래된순") },
          { value: "reading", label: t("五十音順", "읽기순") },
          { value: "easy", label: t("易しい順", "쉬운순") },
          { value: "hard", label: t("難しい順", "어려운순") },
        ]} />
    </div>
  </div>;
}
