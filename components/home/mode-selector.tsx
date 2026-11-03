import { useSettings } from "@/app/settings";
import { trainingModes, type TrainingMode } from "@/lib/game/learning/types";

export function ModeSelector({
  modes,
  onToggle,
}: {
  modes: TrainingMode[];
  onToggle: (mode: TrainingMode) => void;
}) {
  const { prefs } = useSettings();
  const t = (jp: string, kr: string) => (prefs.lang === "jp" ? jp : kr);
  return (
    <>
      <p className="selection-label">
        {t("学習モード", "학습 모드")}
        <span>{t("複数選択可", "복수 선택 가능")}</span>
      </p>
      <div
        className="training-levels training-kinds"
        role="group"
        aria-label={t("学習モード（複数選択可）", "학습 모드 (복수 선택 가능)")}
      >
        {trainingModes.map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={modes.includes(mode)}
            onClick={() => onToggle(mode)}
            title={
              mode === "exploration"
                ? t(
                    "実力に合わせて新しい単語にも挑戦",
                    "실력에 맞는 난이도에서 다양한 단어를 탐색해요",
                  )
                : t(
                    "記憶と復習時期に合わせて出題。記録がなくても選択できます。",
                    "기억 상태와 복습 시점에 따라 출제해요. 기록이 없어도 선택할 수 있어요.",
                  )
            }
          >
            <span className="kind-check" aria-hidden="true">
              {modes.includes(mode) ? "✓" : "+"}
            </span>
            {mode === "exploration" ? t("探索", "탐색") : t("復習", "복습")}
          </button>
        ))}
      </div>
      {!modes.length && (
        <p className="level-hint" role="status">
          {t("学習モードを選んでください。", "학습 모드를 선택해주세요.")}
        </p>
      )}
    </>
  );
}
