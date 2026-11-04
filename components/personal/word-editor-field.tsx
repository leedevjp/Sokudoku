import type { Lang } from "@/lib/game/preferences";
import styles from "./personal-styles";

export type WordEditorFieldName =
  | "term"
  | "kana"
  | "meaning_ko"
  | "hanja_reading";
type Props = {
  name: WordEditorFieldName;
  value: string;
  label: string;
  placeholder: string;
  maxLength: number;
  busy: boolean;
  invalid: boolean;
  lang: Lang;
  onChange: (name: WordEditorFieldName, value: string) => void;
};
export function WordEditorField({
  name,
  value,
  label,
  placeholder,
  maxLength,
  busy,
  invalid,
  lang,
  onChange,
}: Props) {
  const t = (jp: string, kr: string) => (lang === "jp" ? jp : kr);
  return (
    <label className={styles.field} htmlFor={"personal-" + name}>
      {label}
      <input
        id={"personal-" + name}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={busy}
        aria-invalid={invalid}
        aria-describedby={invalid ? "error-" + name : undefined}
        lang={name === "term" || name === "kana" ? "ja" : "ko"}
      />
      {invalid && (
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
}
