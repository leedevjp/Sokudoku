import Link from "next/link";
import { useSettings } from "@/app/settings";
import {
  vocabularyLevels,
  kanaLevels,
  levelDifficulty,
  type TrainingLevel,
} from "@/lib/game/selection";

export function LevelSelector({
  levels,
  onToggle,
}: {
  levels: TrainingLevel[];
  onToggle: (level: TrainingLevel) => void;
}) {
  const { prefs } = useSettings();
  const t = (jp: string, kr: string) => (prefs.lang === "jp" ? jp : kr);
  return (
    <>
      <div className="level-heading">
        <p className="selection-label">{t("出題範囲", "출제 범위")}</p>
        <Link href="/personal">{t("マイ単語帳", "내 단어장")} ↗</Link>
      </div>
      <div
        className="training-levels training-kinds kana-levels"
        role="group"
        aria-label={t("かな（複数選択可）", "가나 (복수 선택 가능)")}
      >
        {kanaLevels.map((level) => (
          <button
            key={level}
            type="button"
            aria-pressed={levels.includes(level)}
            onClick={() => onToggle(level)}
          >
            {level === "H"
              ? t("ひらがな", "히라가나")
              : t("カタカナ", "가타카나")}
          </button>
        ))}
      </div>
      <div
        className="training-levels"
        role="group"
        aria-label={t("出題範囲（複数選択可）", "출제 범위 (복수 선택 가능)")}
      >
        {vocabularyLevels.map((level) => (
          <button
            key={level}
            type="button"
            aria-pressed={levels.includes(level)}
            title={
              level === "P"
                ? t("個人単語", "개인 단어")
                : `${t("難易度", "난이도")} ${levelDifficulty[level].join(", ")}`
            }
            aria-label={
              level === "P"
                ? t("個人単語", "개인 단어")
                : `${level}: ${t("難易度", "난이도")} ${levelDifficulty[level].join(", ")}`
            }
            onClick={() => onToggle(level)}
          >
            {level}
          </button>
        ))}
      </div>
      {levels.some((level) => level === "H" || level === "K") && (
        <p className="level-hint kana-hint" role="status">
          {t(
            "かなは「意味」問題でのみ出題されます。",
            "가나는 뜻 맞추기에서만 출제돼요.",
          )}
        </p>
      )}
      {levels.length === 0 && (
        <p className="level-hint" role="status">
          {t("出題範囲を選んでください。", "출제 범위를 선택해주세요.")}
        </p>
      )}
    </>
  );
}
