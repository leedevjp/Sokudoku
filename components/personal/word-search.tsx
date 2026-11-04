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
      <label className={styles.search}>
        <span aria-hidden="true">⌕</span>
        <span className={styles.srOnly}>
          {t(
            "表記・読み・意味・韓国漢字音で検索",
            "표기·읽기·뜻·한자음으로 검색",
          )}
        </span>
        <input
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
      </label>
      <div className={styles.meta}>
        <p role="status">
          {data
            ? query.trim()
              ? t("検索結果 ", "검색 결과 ") +
                data.total.toLocaleString() +
                t("件 / 全", "개 / 전체 ") +
                data.all_total.toLocaleString() +
                t("語", "개")
              : t("登録した単語 ", "등록한 단어 ") +
                data.all_total.toLocaleString() +
                t("語", "개")
            : error
              ? t("マイ単語帳", "내 단어장")
              : t("単語帳を読み込み中…", "단어장을 불러오는 중…")}
          {loading && data ? " · " + t("更新中…", "갱신 중…") : ""}
        </p>
        <button onClick={() => onRefresh()} disabled={loading}>
          {t("更新", "새로고침")} ↻
        </button>
      </div>
    </section>
  );
}
