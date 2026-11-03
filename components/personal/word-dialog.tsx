"use client";
import { useRef, useState } from "react";
import { useSettings } from "@/app/settings";
import { Modal } from "@/components/ui/modal";
import type { PersonalWord } from "@/lib/personal/types";
import { personalMessage } from "@/lib/personal/messages";
import { choiceLabel } from "@/lib/game/rules";
import styles from "./personal.module.css";
export function WordDialog({
  word,
  mode,
  onClose,
  onEdit,
  onDelete,
  onDeleted,
}: {
  word: PersonalWord;
  mode: "detail" | "delete";
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDeleted: () => void;
}) {
  const { prefs } = useSettings();
  const t = (jp: string, kr: string) => (prefs.lang === "jp" ? jp : kr);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  async function remove() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/personal/" + word.id, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updated_at: word.updated_at }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        const result = await response.json();
        setError(result.error ?? "save_failed");
        return;
      }
      onDeleted();
    } catch {
      setError("save_failed");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      dismissDisabled={busy}
      onClose={() => {
        if (!lock.current) onClose();
      }}
      titleId="personal-detail-title"
    >
      <div className={styles.modal} aria-busy={busy}>
        <span className={styles.eyebrow}>
          P · {t("自分だけの単語", "나만의 단어")}
        </span>
        {mode === "delete" ? (
          <>
            <h2 id="personal-detail-title">
              {t("この単語を削除しますか？", "이 단어를 삭제할까요?")}
            </h2>
            <div className={styles.deleteWord}>
              <strong lang="ja">{word.term}</strong>
              <span lang="ja">{word.kana}</span>
            </div>
            <p className={styles.description}>
              {t(
                "単語帳から消え、次のトレーニングから出題されなくなります。まちがいノートと学習状況からも除外されます。",
                "단어장에서 사라지고 다음 훈련부터 출제되지 않아요. 오답노트와 학습 현황에서도 제외돼요.",
              )}
            </p>
            {error && (
              <p className={styles.error} role="alert">
                {personalMessage(error, prefs.lang)}
              </p>
            )}
            <div className={styles.actions}>
              <button
                className={styles.secondary}
                disabled={busy}
                onClick={onClose}
              >
                {t("キャンセル", "취소")}
              </button>
              <button
                className={styles.danger}
                disabled={busy}
                onClick={remove}
              >
                {busy ? t("削除中…", "삭제 중…") : t("削除する", "삭제하기")}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2
              className={styles.detailTerm}
              id="personal-detail-title"
              lang="ja"
            >
              {word.term}
            </h2>
            <p className={styles.reading} lang="ja">
              {word.kana}
            </p>
            <div className={styles.preview}>
              <span>{t("韓国語の意味", "한국어 뜻")}</span>
              <b lang="ko">{choiceLabel(word, "meaning")}</b>
            </div>
            <dl className={styles.details}>
              <div>
                <dt>{t("難易度", "난이도")}</dt>
                <dd>{word.difficulty}</dd>
              </div>
              {word.hanja_reading && (
                <div>
                  <dt>{t("韓国漢字音", "한국 한자음")}</dt>
                  <dd lang="ko">{word.hanja_reading}</dd>
                </div>
              )}
              {word.note && (
                <div>
                  <dt>{t("メモ", "메모")}</dt>
                  <dd>{word.note}</dd>
                </div>
              )}
            </dl>
            <div className={styles.actions}>
              <button className={styles.secondary} onClick={onDelete}>
                {t("削除", "삭제")}
              </button>
              <button className={styles.primary} onClick={onEdit}>
                {t("編集する", "수정하기")}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
