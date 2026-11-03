"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSettings } from "@/components/settings/settings-provider";
import { Modal } from "@/components/ui/modal";
import { personalWordInput } from "@/lib/personal/schema";
import { personalMessage } from "@/lib/personal/messages";
import type { PersonalWord } from "@/lib/personal/types";
import { choiceLabel } from "@/lib/game/rules";
import styles from "./personal.module.css";

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
  const [form, setForm] = useState(() => ({
    term: word?.term ?? "",
    kana: word?.kana ?? "",
    meaning_ko: word?.meaning_ko ?? "",
    hanja_reading: word?.hanja_reading ?? "",
    difficulty: word?.difficulty ?? 6,
    note: word?.note ?? "",
  }));
  const baseline = useRef(JSON.stringify(form));
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [discard, setDiscard] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<string[]>([]);
  const dirty = JSON.stringify(form) !== baseline.current;
  useEffect(() => {
    if (!dirty || busy) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty, busy]);
  function close() {
    if (lock.current) return;
    if (dirty) setDiscard(true);
    else onClose();
  }
  function field(name: keyof typeof form, value: string | number) {
    setForm((old) => ({ ...old, [name]: value }));
    setFields((old) => old.filter((f) => f !== name));
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    const parsed = personalWordInput.safeParse(form);
    if (!parsed.success) {
      setFields([
        ...new Set(parsed.error.issues.map((i) => String(i.path[0]))),
      ]);
      setError("invalid_input");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        "/api/personal" + (word ? "/" + word.id : ""),
        {
          method: word ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            ...parsed.data,
            ...(word ? { updated_at: word.updated_at } : {}),
          }),
        },
      );
      if (!response.ok) {
        const result = await response.json();
        setError(result.error ?? "save_failed");
        setFields(Object.keys(result.fields ?? {}));
        return;
      }
      onSaved(!word);
    } catch {
      setError("save_failed");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const input = (
    name: "term" | "kana" | "meaning_ko" | "hanja_reading",
    label: string,
    placeholder: string,
    maxLength: number,
  ) => (
    <label className={styles.field} htmlFor={"personal-" + name}>
      {label}
      <input
        id={"personal-" + name}
        value={form[name]}
        onChange={(e) => field(name, e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={busy}
        aria-invalid={fields.includes(name)}
        aria-describedby={fields.includes(name) ? "error-" + name : undefined}
        lang={name === "term" || name === "kana" ? "ja" : "ko"}
      />
      {fields.includes(name) && (
        <small className={styles.fieldError} id={"error-" + name}>
          {name === "kana"
            ? t(
                "かなで入力してください。数字・記号・改行は使えません。",
                "히라가나·가타카나로 입력해주세요. 숫자·특수문자·줄바꿈은 쓸 수 없어요.",
              )
            : name === "hanja_reading"
              ? t(
                  "韓国語の漢字音だけを入力してください。",
                  "한국 한자음만 한글로 입력해주세요.",
                )
              : name === "term"
                ? t(
                    "100文字以内で、文字・数字・単語に必要な記号だけを入力してください。",
                    "100자 이내로 문자·숫자와 단어에 필요한 기호만 입력해주세요.",
                  )
                : t(
                    "1,000文字以内の文章を入力してください。HTML・制御文字は使えません。",
                    "1,000자 이내 문장을 입력해주세요. HTML·제어문자는 쓸 수 없어요.",
                  )}
        </small>
      )}
    </label>
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
