import { useSettings } from "@/components/settings/settings-provider";
import type { PersonalWordList } from "@/lib/personal/types";
import styles from "./personal-styles";

export function WordSearch({
  query,
  data,
  loading,
  error,
  onQueryChange,
  onRefresh,
}: {
  query: string;
  data: PersonalWordList | null;
  loading: boolean;
  error: string | null;
  onQueryChange: (query: string) => void;
  onRefresh: () => void;
}) {
  const { prefs } = useSettings();
  const t = (jp: string, kr: string) => (prefs.lang === "jp" ? jp : kr);
  return (
    <section
      className={styles.searchPanel}
      aria-label={t("単語を検索", "단어 검색")}
    >
      <div className={styles.search}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>
        <span className={styles.srOnly}>
          {t(
            "表記・読み・意味・韓国漢字音で検索",
            "표기·읽기·뜻·한자음으로 검색",
          )}
        </span>
        <input
          aria-label={t("表記・読み・意味・韓国漢字音で検索", "표기·읽기·뜻·한자음으로 검색")}
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          maxLength={100}
          placeholder={t("表記・読み・意味で検索", "표기·읽기·뜻으로 검색")}
        />
        {query && (
          <button
            onClick={() => onQueryChange("")}
            aria-label={t("検索をクリア", "검색어 지우기")}
          >
            ×
          </button>
        )}
      </div>
      <output className={styles.resultCount} aria-live="polite" aria-label={t("検索結果", "검색 결과")}>
        {data ? <>{data.total.toLocaleString()}<span>/{data.all_total.toLocaleString()}</span></> : error ? "—" : "…"}
      </output>
      <button className={styles.refreshButton} onClick={onRefresh} disabled={loading} aria-label={t("更新", "새로고침")} title={t("更新", "새로고침")}>↻</button>
    </section>
  );
}
