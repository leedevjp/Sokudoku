"use client";
import Link from "next/link";
import { useState } from "react";
import { useSettings } from "@/app/settings";
import { choiceLabel } from "@/lib/game/rules";
import type { PersonalWord } from "@/lib/personal/types";
import { personalMessage } from "@/lib/personal/messages";
import { usePersonalWords } from "./use-personal-words";
import { WordEditor } from "./word-editor";
import { WordDialog } from "./word-dialog";
import styles from "./personal.module.css";

type Dialog =
  | { mode: "create" }
  | { mode: "edit" | "detail" | "delete"; word: PersonalWord }
  | null;
export default function PersonalScreen() {
  const { prefs, change } = useSettings();
  const t = (jp: string, kr: string) => (prefs.lang === "jp" ? jp : kr);
  const words = usePersonalWords();
  const { data, loading, error, query } = words;
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState<
    "created" | "updated" | "deleted" | null
  >(null);
  const pages = Math.max(
    1,
    Math.ceil((data?.total ?? 0) / (data?.page_size ?? 20)),
  );
  function saved(created: boolean) {
    setDialog(null);
    setNotice(created ? "created" : "updated");
    words.refresh(created);
  }
  function deleted() {
    setDialog(null);
    setNotice("deleted");
    words.refresh();
  }
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link
          className={styles.iconButton}
          href="/"
          aria-label={t("ホーム", "메인으로")}
        >
          <svg
            aria-hidden="true"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="m14 5-7 7 7 7"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <h1>{t("マイ単語帳", "내 단어장")}</h1>
        <button
          className={styles.language}
          onClick={() => change({ lang: prefs.lang === "jp" ? "kr" : "jp" })}
          aria-label="KR / JP"
        >
          {prefs.lang === "jp" ? "JP ⇄ KR" : "KR ⇄ JP"}
        </button>
        <button
          className={styles.iconButton}
          onClick={() =>
            change({ theme: prefs.theme === "light" ? "dark" : "light" })
          }
          aria-label={t("テーマを切り替える", "테마 전환")}
        >
          {prefs.theme === "light" ? "☾" : "☀"}
        </button>
      </header>
      <section className={styles.intro}>
        <div className={styles.introTitle}>
          <span className={styles.pBadge}>P</span>
          <div>
            <b>{t("自分だけの言葉を", "나에게 필요한 단어만")}</b>
            <p>
              {t(
                "この単語帳は自分にだけ見えます。",
                "이 단어장은 나에게만 보여요.",
              )}
            </p>
          </div>
        </div>
        <button
          className={styles.primary}
          onClick={() => {
            setNotice(null);
            setDialog({ mode: "create" });
          }}
        >
          {t("＋ 単語を追加", "＋ 단어 추가")}
        </button>
      </section>
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
            onChange={(e) => words.setQuery(e.target.value)}
            maxLength={100}
            placeholder={t("表記・読み・意味で検索", "표기·읽기·뜻으로 검색")}
          />
          {query && (
            <button
              onClick={() => words.setQuery("")}
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
                : error
                  ? t("マイ単語帳", "내 단어장")
                  : t("単語帳を読み込み中…", "단어장을 불러오는 중…")}
            {loading && data ? " · " + t("更新中…", "갱신 중…") : ""}
          </p>
          <button onClick={() => words.refresh()} disabled={loading}>
            {t("更新", "새로고침")} ↻
          </button>
        </div>
      </section>
      {notice && (
        <p className={styles.notice} role="status">
          {notice === "created"
            ? t(
                "単語を追加しました。次のトレーニングから使えます。",
                "단어를 추가했어요. 다음 훈련부터 사용할 수 있어요.",
              )
            : notice === "updated"
              ? t(
                  "更新しました。学習記録は引き継がれます。",
                  "수정했어요. 학습 기록은 그대로 유지돼요.",
                )
              : t(
                  "削除しました。次のトレーニングから出題されません。",
                  "삭제했어요. 다음 훈련부터 출제되지 않아요.",
                )}
        </p>
      )}
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
                : t(
                    "単語帳を読み込めませんでした",
                    "단어장을 불러오지 못했어요",
                  )}
            </h2>
            <p>{personalMessage(error, prefs.lang)}</p>
            {error === "unauthorized" ? (
              <Link className={styles.primary} href="/?login=1">
                {t("ログインへ", "로그인하기")} →
              </Link>
            ) : (
              <button
                className={styles.primary}
                onClick={() => words.refresh()}
              >
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
              onClick={() =>
                data.all_total === 0
                  ? setDialog({ mode: "create" })
                  : words.setQuery("")
              }
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
                    onClick={() => setDialog({ mode: "detail", word })}
                    aria-label={
                      word.term + " · " + t("詳細を表示", "상세 보기")
                    }
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
                      onClick={() => setDialog({ mode: "edit", word })}
                    >
                      {t("編集", "수정")}
                    </button>
                    <button
                      className={styles.deleteLink}
                      disabled={loading}
                      onClick={() => setDialog({ mode: "delete", word })}
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
                onClick={() => words.setPage(data.page - 1)}
              >
                ← {t("前へ", "이전")}
              </button>
              <span>
                {data.page} / {pages}
              </span>
              <button
                disabled={loading || data.page >= pages}
                onClick={() => words.setPage(data.page + 1)}
              >
                {t("次へ", "다음")} →
              </button>
            </nav>
          </>
        )}
      </section>
      <p className={styles.footer}>
        {t(
          "編集しても記録はそのまま。削除した単語は出題・まちがいノート・学習状況から除外されます。",
          "수정해도 기록은 그대로. 삭제한 단어는 출제·오답노트·학습 현황에서 제외돼요.",
        )}
      </p>
      {(dialog?.mode === "create" || dialog?.mode === "edit") && (
        <WordEditor
          key={dialog.mode === "edit" ? dialog.word.id : "new"}
          word={dialog.mode === "edit" ? dialog.word : null}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
      {(dialog?.mode === "detail" || dialog?.mode === "delete") && (
        <WordDialog
          key={dialog.word.id + dialog.mode}
          word={dialog.word}
          mode={dialog.mode}
          onClose={() => setDialog(null)}
          onEdit={() => setDialog({ mode: "edit", word: dialog.word })}
          onDelete={() => setDialog({ mode: "delete", word: dialog.word })}
          onDeleted={deleted}
        />
      )}
    </main>
  );
}
