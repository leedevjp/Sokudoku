import Link from "next/link";
import type { Translate } from "@/lib/dashboard/types";
import type { DashboardSummary } from "@/lib/dashboard/summary";
import styles from "./dashboard-styles";

export function DashboardState({
  error,
  summary,
  t,
  retry,
}: {
  error: "login" | "load" | null;
  summary: DashboardSummary | null;
  t: Translate;
  retry: () => void;
}) {
  return error ? (
    <section className={styles.empty} role="alert">
      <span className={styles.emptyIcon}>↻</span>
      <h2>
        {error === "login"
          ? t("ログインしてください", "로그인이 필요해요")
          : t("読み込めませんでした", "현황을 불러오지 못했어요")}
      </h2>
      <p>
        {t("記録はそのまま残っています。", "학습 기록은 그대로 남아 있어요.")}
      </p>
      {error === "login" ? (
        <Link className={styles.cta} href="/?login=1">
          {t("ログインへ", "로그인하기")} →
        </Link>
      ) : (
        <button className={styles.cta} onClick={retry}>
          {t("もう一度試す", "다시 시도하기")} ↻
        </button>
      )}
    </section>
  ) : !summary ? (
    <div
      className={styles.skeleton}
      role="status"
      aria-label={t("読み込み中", "학습 현황 불러오는 중")}
    >
      <div />
      <div />
      <div />
    </div>
  ) : summary.learned === 0 ? (
    <section className={styles.empty}>
      <span className={styles.emptyIcon}>✧</span>
      <h2>
        {summary.hasAnyHistory
          ? t("この範囲はこれから", "이 범위는 이제 시작이에요")
          : t("最初の一歩を始めよう", "첫 학습을 시작해보세요")}
      </h2>
      <p>
        {summary.hasAnyHistory
          ? t(
              "ほかの範囲の記録は残っています。選択を変えるか、新しく学習してみましょう。",
              "다른 범위의 기록은 남아 있어요. 선택을 바꾸거나 새로운 학습을 시작해보세요.",
            )
          : t(
              "学習すると、ここに記憶の成長が見えてきます。",
              "학습을 시작하면 이곳에서 기억이 쌓이는 모습을 볼 수 있어요.",
            )}
      </p>
      <Link className={styles.cta} href="/">
        {t("トレーニングへ", "훈련하러 가기")} →
      </Link>
    </section>
  ) : null;
}
