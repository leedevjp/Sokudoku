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
      <div className="selection-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span>{t("学習モード", "학습 모드")}</span>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}>
          <span>{t("制限時間", "시간제한")}</span>
          <input type="checkbox" role="switch" aria-label={t("制限時間", "시간제한")} checked={timeLimited} onChange={(event) => onTimeLimitChange(event.target.checked)} style={{ position: "absolute", opacity: 0, width: 1, height: 1 }} />
          <span aria-hidden="true" style={{ width: 38, height: 22, borderRadius: 99, background: timeLimited ? "#2d7deb" : "#9ca3af", display: "inline-flex", alignItems: "center", padding: 3, boxSizing: "border-box", justifyContent: timeLimited ? "flex-end" : "flex-start", transition: "background .15s" }}>
            <span style={{ width: 16, height: 16, background: "#fff", borderRadius: "50%", boxShadow: "0 1px 3px #0002" }} />
          </span>
        </label>
      </div>
      <div
        className="training-levels training-kinds training-modes"
        role="group"
        aria-label={t(
          "学習モード（探索と復習は併用可、テストは単独）",
          "학습 모드 (탐색과 복습은 함께 선택 가능, 시험은 단독)",
        )}
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
            {mode === "exploration"
              ? t("探索", "탐색")
              : mode === "exam"
                ? t("テスト", "시험")
                : t("復習", "복습")}
          </button>
        ))}
      </div>
      {modes.includes("exam") && (
        <p className="level-hint" role="status">
          {t(
            "学習済みも含む全範囲からランダム出題。結果は学習・復習に反映します。",
            "이미 학습한 단어도 포함해 전체 범위에서 랜덤 출제합니다. 결과는 학습·복습에 반영됩니다.",
          )}
        </p>
      )}
      {!modes.length && (
        <p className="level-hint" role="status">
          {t("学習モードを選んでください。", "학습 모드를 선택해주세요.")}
        </p>
      )}
    </>
  );
}
