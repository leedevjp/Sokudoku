import Link from "next/link";
import { useSettings } from "@/components/settings/settings-provider";
import { choiceLabel } from "@/lib/game/rules";
import { personalMessage } from "@/lib/personal/messages";
import type { PersonalWord, PersonalWordList } from "@/lib/personal/types";
import styles from "./personal-styles";

export function WordList({
  data,
  loading,
  error,
  onSelect,
  onCreate,
  onClear,
  onRetry,
  onPage,
}: {
  data: PersonalWordList | null;
  loading: boolean;
  error: string | null;
  onSelect: (mode: "detail" | "edit" | "delete", word: PersonalWord) => void;
  onCreate: () => void;
  onClear: () => void;
  onRetry: () => void;
  onPage: (page: number) => void;
}) {
  const { prefs } = useSettings();
  const t = (jp: string, kr: string) => (prefs.lang === "jp" ? jp : kr);
  const pages = Math.max(
    1,
    Math.ceil((data?.total ?? 0) / (data?.page_size ?? 20)),
  );
  return (
    <section
      aria-busy={loading}
      className={styles.listSection}
      aria-label={t("個人単語の一覧", "개인 단어 목록")}
    >
      {error ? (
        <div className={styles.empty} role="alert">
          <span className={styles.emptyMark}>↻</span>
          <h2>
            {error === "unauthorized"
              ? t("ログインしてください", "로그인이 필요해요")
              : t("単語帳を読み込めませんでした", "단어장을 불러오지 못했어요")}
          </h2>
          <p>{personalMessage(error, prefs.lang)}</p>
          {error === "unauthorized" ? (
            <Link className={styles.primary} href="/?login=1">
              {t("ログインへ", "로그인하기")} →
            </Link>
          ) : (
            <button className={styles.primary} onClick={() => onRetry()}>
              {t("もう一度試す", "다시 시도하기")}
            </button>
          )}
        </div>
      ) : !data ? (
        <div
          className={styles.skeleton}
          role="status"
          aria-label={t("読み込み中", "불러오는 중")}
        >
          <div />
          <div />
          <div />
          <div />
        </div>
      ) : data.words.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyMark}>
            {data.all_total === 0 ? "＋" : "⌕"}
          </span>
          <h2>
            {data.all_total === 0
              ? t("最初の単語を追加しよう", "첫 단어를 추가해보세요")
              : t("一致する単語がありません", "검색 결과가 없어요")}
          </h2>
          <p>
            {data.all_total === 0
              ? t(
                  "仕事や日常で覚えたい言葉を、自分のペースで。",
                  "실무와 일상에서 외우고 싶은 단어를 모아보세요.",
                )
              : t(
                  "検索語を変えるか、検索をクリアしてください。",
                  "다른 검색어를 입력하거나 검색어를 지워주세요.",
                )}
          </p>
          <button
            className={styles.primary}
            onClick={() => (data.all_total === 0 ? onCreate() : onClear())}
          >
            {data.all_total === 0
              ? t("単語を追加", "단어 추가")
              : t("検索をクリア", "검색어 지우기")}
          </button>
        </div>
      ) : (
        <>
          <div className={styles.list}>
            {data.words.map((word) => (
              <article className={styles.wordRow} key={word.id}>
                <button
                  className={styles.wordMain}
                  disabled={loading}
                  onClick={() => onSelect("detail", word)}
                  aria-label={word.term + " · " + t("詳細を表示", "상세 보기")}
                >
                  <strong lang="ja">{word.term}</strong>
                  <span className={styles.reading} lang="ja">
                    {word.kana}
                  </span>
                  <span className={styles.meaning} lang="ko">
                    {choiceLabel(word, "meaning")}
                  </span>
                </button>
                <div className={styles.rowActions}>
                  <button
                    disabled={loading}
                    onClick={() => onSelect("edit", word)}
                  >
                    {t("編集", "수정")}
                  </button>
                  <button
                    className={styles.deleteLink}
                    disabled={loading}
                    onClick={() => onSelect("delete", word)}
                  >
                    {t("削除", "삭제")}
                  </button>
                </div>
              </article>
            ))}
          </div>
          <nav
            className={styles.pagination}
            aria-label={t("ページ移動", "페이지 이동")}
          >
            <button
              disabled={loading || data.page <= 1}
              onClick={() => onPage(data.page - 1)}
            >
              ← {t("前へ", "이전")}
            </button>
            <span>
              {data.page} / {pages}
            </span>
            <button
              disabled={loading || data.page >= pages}
              onClick={() => onPage(data.page + 1)}
            >
              {t("次へ", "다음")} →
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
