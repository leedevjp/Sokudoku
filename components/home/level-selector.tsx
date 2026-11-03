import { useSettings } from "@/app/settings";
import {
  trainingLevels,
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
      {" "}
      <div
        className="training-levels"
        role="group"
        aria-label={t("出題範囲（複数選択可）", "출제 범위 (복수 선택 가능)")}
      >
        {trainingLevels.map((level) => (
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
      {levels.length === 0 && (
        <p className="level-hint" role="status">
          {t("出題範囲を選んでください。", "출제 범위를 선택해주세요.")}
        </p>
      )}
    </>
  );
}
