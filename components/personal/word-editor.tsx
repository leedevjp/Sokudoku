"use client";
import { personalMessage } from "@/lib/personal/messages";
import { useSettings } from "@/components/settings/settings-provider";
import { Modal } from "@/components/ui/modal";
import { useWordEditor } from "./use-word-editor";
import { WordEditorField, type WordEditorFieldName } from "./word-editor-field";
import type { PersonalWord } from "@/lib/personal/types";
import { choiceLabel } from "@/lib/game/rules";
import styles from "./personal-styles";

export function WordEditor({
  word,
  onClose,
  onSaved,
}: {
  word: PersonalWord | null;
  onClose: () => void;
  onSaved: (created: boolean) => void;
}) {
  const { prefs } = useSettings();
  const t = (jp: string, kr: string) => (prefs.lang === "jp" ? jp : kr);
  const { form, busy, discard, setDiscard, error, fields, close, field, save } =
    useWordEditor(word, onClose, onSaved);
  const input = (
    name: WordEditorFieldName,
    label: string,
    placeholder: string,
    maxLength: number,
  ) => (
    <WordEditorField
      name={name}
      value={form[name]}
      label={label}
      placeholder={placeholder}
      maxLength={maxLength}
      busy={busy}
      invalid={fields.includes(name)}
      lang={prefs.lang}
      onChange={field}
    />
  );

  return (
    <Modal
      open
      dismissDisabled={busy}
      onClose={close}
      titleId="personal-editor-title"
    >
      <div className={styles.modal}>
        <span className={styles.eyebrow}>
          P · {t("自分の単語帳", "내 단어장")}
        </span>
        <h2 id="personal-editor-title">
          {discard
            ? t("変更を破棄しますか？", "변경 내용을 버릴까요?")
            : word
              ? t("単語を編集", "단어 수정")
              : t("単語を追加", "단어 추가")}
        </h2>
        {discard ? (
          <>
            <p className={styles.description}>
              {t(
                "保存していない入力内容は失われます。",
                "저장하지 않은 입력 내용은 사라져요.",
              )}
            </p>
            <div className={styles.actions}>
              <button
                className={styles.secondary}
                onClick={() => setDiscard(false)}
              >
                {t("編集に戻る", "계속 작성하기")}
              </button>
              <button className={styles.danger} onClick={onClose}>
                {t("破棄して閉じる", "버리고 닫기")}
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={save} noValidate aria-busy={busy}>
            <p className={styles.description}>
              {t(
                "1項目に1つの単語を入力してください。",
                "한 항목에 하나의 단어를 입력해주세요.",
              )}
            </p>
            {input("term", t("日本語の表記 *", "일본어 표기 *"), "実装", 100)}
            {input("kana", t("読み *", "읽기 *"), "じっそう", 200)}
            {input(
              "meaning_ko",
              t("韓国語の意味 *", "한국어 뜻 *"),
              "구현",
              1000,
            )}
            <details
              className={styles.advanced}
              open={
                !!word?.hanja_reading ||
                !!word?.note ||
                fields.some((f) =>
                  ["hanja_reading", "difficulty", "note"].includes(f),
                )
              }
            >
              <summary>
                {t("追加情報", "추가 정보")}{" "}
                <span>{t("漢字音・難易度・メモ", "한자음·난이도·메모")}</span>
              </summary>
              {input(
                "hanja_reading",
                t("韓国漢字音（任意）", "한국 한자음 (선택)"),
                "실장",
                100,
              )}
              <p className={styles.hint}>
                {t(
                  "翻訳ではなく漢字を韓国語で読んだ音です。実装 → 실장、意味 → 구현。",
                  "번역이 아니라 한자를 한국 한자음으로 읽은 값이에요. 実装 → 실장, 뜻 → 구현.",
                )}
              </p>
              <label className={styles.field} htmlFor="personal-difficulty">
                {t("難易度", "난이도")}
                <select
                  id="personal-difficulty"
                  value={form.difficulty}
                  onChange={(e) => field("difficulty", Number(e.target.value))}
                  disabled={busy}
                >
                  {Array.from({ length: 11 }, (_, n) => (
                    <option key={n} value={n}>
                      {n}
                      {n === 10 ? " · " + t("専門・実務", "전문·실무") : ""}
                    </option>
                  ))}
                </select>
              </label>
              <p className={styles.hint}>
                {t(
                  "0が初級、10が専門・実務の目安です。どの難易度もPに含まれます。",
                  "0은 입문, 10은 전문·실무의 기준이에요. 어떤 난이도든 P에 포함돼요.",
                )}
              </p>
              <label className={styles.field} htmlFor="personal-note">
                {t("メモ（任意）", "메모 (선택)")}
                <textarea
                  id="personal-note"
                  rows={4}
                  value={form.note}
                  onChange={(e) => field("note", e.target.value)}
                  maxLength={4000}
                  disabled={busy}
                />
                {fields.includes("note") && (
                  <small className={styles.fieldError}>
                    {t(
                      "4,000文字以内の文章を入力してください。HTML・制御文字は使えません。",
                      "4,000자 이내 문장을 입력해주세요. HTML·제어문자는 쓸 수 없어요.",
                    )}
                  </small>
                )}
              </label>
            </details>
            <div className={styles.preview}>
              <span>{t("意味の表示プレビュー", "뜻 표시 미리보기")}</span>
              <b lang="ko">{choiceLabel(form, "meaning") || "—"}</b>
            </div>
            {word && (
              <p className={styles.hint}>
                {t(
                  "編集しても学習記録は引き継がれます。",
                  "수정해도 기존 학습 기록은 유지돼요.",
                )}
              </p>
            )}
            {error && (
              <p className={styles.error} role="alert">
                {personalMessage(error, prefs.lang)}
              </p>
            )}
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondary}
                disabled={busy}
                onClick={close}
              >
                {t("キャンセル", "취소")}
              </button>
              <button className={styles.primary} disabled={busy}>
                {busy ? t("保存中…", "저장 중…") : t("保存する", "저장하기")}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
