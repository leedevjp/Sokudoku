"use client";
import Link from "next/link";
import { useState } from "react";
import { useSettings } from "@/components/settings/settings-provider";
import type { PersonalWord } from "@/lib/personal/types";
import { usePersonalWords } from "./use-personal-words";
import { WordEditor } from "./word-editor";
import { WordDialog } from "./word-dialog";
import { WordSearch } from "./word-search";
import { WordList } from "./word-list";
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
      <WordSearch
        data={data}
        query={query}
        loading={loading}
        error={error}
        onQueryChange={words.setQuery}
        onRefresh={() => words.refresh()}
      />
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
      <WordList
        data={data}
        loading={loading}
        error={error}
        onSelect={(mode, word) => setDialog({ mode, word })}
        onCreate={() => setDialog({ mode: "create" })}
        onClear={() => words.setQuery("")}
        onRetry={() => words.refresh()}
        onPage={words.setPage}
      />
      <p className={styles.footer}>
        {t(
          "編集しても記録はそのまま。削除すると単語と関連する回答・復習記録を完全に削除します。",
          "수정해도 기록은 그대로. 삭제하면 단어와 연결된 답변·복습 기록을 영구 삭제해요.",
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
