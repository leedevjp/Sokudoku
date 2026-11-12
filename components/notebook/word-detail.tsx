import { useState } from "react";
import styles from "./personal-actions.module.css";
import { useSettings } from "@/components/settings/settings-provider";
import { Modal } from "@/components/ui/modal";
import { choiceLabel } from "@/lib/game/rules";
import type { NotebookWord } from "@/lib/notebook/types";

export function WordDetail({
  word,
  onClose, busy, message, onAdd, onRemove,
}: {
  word: NotebookWord | null;
  onClose: () => void;
  onRemove: (word: NotebookWord) => void;
  busy: boolean; message: string; onAdd: (id: string) => void;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const { prefs } = useSettings();
  const t = (jp: string, kr: string) => (prefs.lang === "jp" ? jp : kr);
  return (
    <Modal dismissDisabled={busy} open={word !== null} onClose={onClose} titleId="notebook-word-title">
      {word && (
        <div className={styles.detail}>
          <p className="eyebrow">
            {word.source === "personal"
              ? t("個人単語", "개인 단어")
              : t("共通単語", "공통 단어")}{" "}
            · {t("難易度", "난이도")} {word.difficulty}
          </p>
          <h2
            id="notebook-word-title"
            className={styles.detailTitle}
            lang="ja"
          >
            {word.term}
          </h2>
          <dl className="notebook-detail">
            <div>
              <dt>{t("読み方", "읽기")}</dt>
              <dd lang="ja">{word.kana}</dd>
            </div>
            <div>
              <dt>{t("韓国語の意味", "한국어 뜻")}</dt>
              <dd lang="ko">{choiceLabel(word, "meaning")}</dd>
            </div>
            {word.note?.trim() && (
              <div>
                <dt>{t("メモ", "메모")}</dt>
                <dd className="notebook-note">{word.note}</dd>
              </div>
            )}
          </dl>
          {word.in_personal && word.personal_entry ? (
            confirmRemove ? <div className={styles.removePanel}>
              <p>{t("Pの単語と関連する回答・復習記録を削除します。元に戻せません。", "P 단어와 연결된 답변·복습 기록을 삭제해요. 복구할 수 없어요.")}</p>
              <div className={styles.removeActions}>
                <button className={styles.textButton} disabled={busy} onClick={() => setConfirmRemove(false)}>{t("キャンセル", "취소")}</button>
                <button className={styles.removeButton} disabled={busy} onClick={() => onRemove(word)}>{busy ? t("解除中…", "해제 중…") : t("解除する", "해제하기")}</button>
              </div>
            </div> : <button className={styles.removeButton} disabled={busy} onClick={() => setConfirmRemove(true)}>{t("Pから解除", "P에서 해제")}</button>
          ) : word.source === "word" && word.can_add_personal && <button className={styles.addButton} disabled={busy || word.in_personal} onClick={() => { setConfirmRemove(false); onAdd(word.id); }}>{word.in_personal ? t("Pに登録済み", "이미 P에 있음") : busy ? t("追加中…", "추가 중…") : t("Pに追加", "P에 추가")}</button>}
          {message && <p className={styles.detailFeedback} role="status">{message}</p>}
          <p className="footnote">
            {t("最後のまちがい", "마지막 오답")} ·{" "}
            {new Date(word.last_incorrect_at).toLocaleString(
              prefs.lang === "jp" ? "ja-JP" : "ko-KR",
            )}
          </p>
        </div>
      )}
    </Modal>
  );
}
