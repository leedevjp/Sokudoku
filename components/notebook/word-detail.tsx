import { useSettings } from "@/components/settings/settings-provider";
import { Modal } from "@/components/ui/modal";
import { choiceLabel } from "@/lib/game/rules";
import type { NotebookWord } from "@/lib/notebook/types";

export function WordDetail({
  word,
  onClose,
}: {
  word: NotebookWord | null;
  onClose: () => void;
}) {
  const { prefs } = useSettings();
  const t = (jp: string, kr: string) => (prefs.lang === "jp" ? jp : kr);
  return (
    <Modal open={word !== null} onClose={onClose} titleId="notebook-word-title">
      {word && (
        <>
          <p className="eyebrow">
            {word.source === "personal"
              ? t("個人単語", "개인 단어")
              : t("共通単語", "공통 단어")}{" "}
            · {t("難易度", "난이도")} {word.difficulty}
          </p>
          <h2
            id="notebook-word-title"
            className="notebook-detail-term"
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
          <p className="footnote">
            {t("最後のまちがい", "마지막 오답")} ·{" "}
            {new Date(word.last_incorrect_at).toLocaleString(
              prefs.lang === "jp" ? "ja-JP" : "ko-KR",
            )}
          </p>
        </>
      )}
    </Modal>
  );
}
