import { useSettings } from "@/components/settings/settings-provider";
import { trainingKinds } from "@/lib/game/selection";
import type { Kind } from "@/lib/game/types";

export function KindSelector({
  kinds,
  onToggle,
}: {
  kinds: Kind[];
  onToggle: (kind: Kind) => void;
}) {
  const { prefs } = useSettings();
  const t = (jp: string, kr: string) => (prefs.lang === "jp" ? jp : kr);
  return (
    <div className="kind-selector">
      <p className="selection-label">
        {t("問題タイプ", "문제 유형")}
        <span>{t("複数選択可", "복수 선택 가능")}</span>
      </p>
      <div
        className="training-levels training-kinds"
        role="group"
        aria-label={t("問題タイプ（複数選択可）", "문제 유형 (복수 선택 가능)")}
      >
        {trainingKinds.map((kind) => (
          <button
            key={kind}
            type="button"
            aria-pressed={kinds.includes(kind)}
            onClick={() => onToggle(kind)}
          >
            <span className="kind-check" aria-hidden="true">
              {kinds.includes(kind) ? "✓" : "+"}
            </span>
            {kind === "reading"
              ? t("読み方", "읽기 맞추기")
              : t("意味", "뜻 맞추기")}
          </button>
        ))}
      </div>
      {!kinds.length && (
        <p className="level-hint" role="status">
          {t("問題タイプを選んでください。", "문제 유형을 선택해주세요.")}
        </p>
      )}
    </div>
  );
}
