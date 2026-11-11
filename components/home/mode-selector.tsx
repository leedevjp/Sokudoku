import { useSettings } from "@/components/settings/settings-provider";
import { trainingModes, type TrainingMode } from "@/lib/game/learning/types";

export function ModeSelector({
  modes,
  onToggle,
  timeLimited,
  onTimeLimitChange,
}: {
  modes: TrainingMode[];
  onToggle: (mode: TrainingMode) => void;
  timeLimited: boolean;
  onTimeLimitChange: (value: boolean) => void;
}) {
  const { prefs } = useSettings();
  const t = (jp: string, kr: string) => (prefs.lang === "jp" ? jp : kr);
  return (
    <>
      <div className="home-mode-heading">
        <span className="home-mode-caption">{t("学習モード", "학습 모드")}</span>
        <label className="home-time-toggle">
          <span>{t("制限時間", "시간제한")}</span>
          <input
            type="checkbox"
            role="switch"
            aria-label={t("制限時間", "시간제한")}
            checked={timeLimited}
            onChange={(event) => onTimeLimitChange(event.target.checked)}
          />
          <span className="home-time-track" aria-hidden="true">
            <span className="home-time-thumb" />
          </span>
        </label>
      </div>
      <div
        className="training-levels training-modes"
        role="group"
        aria-label={t(
          "自動とテストは単独、探索と復習は併用可",
          "자동과 시험은 단독, 탐색과 복습은 함께 선택 가능",
        )}
      >
        {trainingModes.map((mode) => (
          <button
            key={mode}
            className={`training-mode-${mode}`}
            type="button"
            aria-pressed={modes.includes(mode)}
            onClick={() => onToggle(mode)}
            title={
              mode === "auto"
                ? t("記憶と実力に合わせて出題。範囲と問題タイプは自由に変更できます。", "기억과 실력에 맞게 자동 출제해요. 범위와 문제 유형은 직접 제한할 수 있어요.")
                : mode === "exploration"
                ? t(
                    "まだ出会っていない単語を均等ランダムに出題",
                    "아직 만나지 않은 단어를 균등 랜덤으로 출제해요",
                  )
                : mode === "exam"
                  ? t(
                      "選択範囲の全単語を均等ランダムに出題。学習記録と復習にも反映します。",
                      "학습 여부와 관계없이 선택 범위 전체에서 균등 랜덤으로 출제해요. 학습 기록과 복습에도 반영해요.",
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
            {mode === "auto"
              ? t("おまかせ", "자동")
              : mode === "exploration"
              ? t("探索", "탐색")
              : mode === "exam"
                ? t("テスト", "시험")
                : t("復習", "복습")}
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
