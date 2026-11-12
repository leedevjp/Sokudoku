"use client";
import Link from "next/link";
import { SettingsBar } from "@/components/settings/settings-bar";
import { useState } from "react";
import { useSettings } from "@/components/settings/settings-provider";
import type { PersonalWord } from "@/lib/personal/types";
import { usePersonalWords } from "./use-personal-words";
import { WordEditor } from "./word-editor";
import { WordDialog } from "./word-dialog";
import { WordSearch } from "./word-search";
import { WordList } from "./word-list";
import styles from "./personal-styles";

type Dialog =
  | { mode: "create" }
  | { mode: "edit" | "detail" | "delete"; word: PersonalWord }
  | null;
export default function PersonalScreen() {
  const { prefs } = useSettings();
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
    <main className={`site-shell ${styles.screen}`}>
      <header className="site-header">
        <Link className="brand" href="/"><span className="brand-mark">速</span>Sokudoku<span className="brand-dot">.</span></Link>
        <SettingsBar />
      </header>
      <div className={styles.content}>
      <div className={styles.heading}>
        <Link href="/" className={styles.back} aria-label={t("ホームへ戻る", "메인으로 돌아가기")}>←</Link>
        <h1>{t("マイ単語帳", "내 단어장")}</h1>
        <button className={styles.createButton} onClick={() => { setNotice(null); setDialog({ mode: "create" }); }}>
          {t("＋ 単語を追加", "＋ 단어 추가")}
        </button>
      </div>
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
      </div>
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
