import type { EntryType } from "@/lib/game/types";
import type { Translate } from "@/lib/dashboard/types";
import type { DashboardSummary } from "@/lib/dashboard/summary";
import styles from "./dashboard.module.css";

export function SummaryCards({
  summary,
  entry,
  unit,
  t,
  number,
}: {
  summary: DashboardSummary;
  entry: EntryType;
  unit: string;
  t: Translate;
  number: (n: number) => string;
}) {
  return (
    <>
      <section className={styles.card}>
        <p className={styles.label}>
          {entry === "word"
            ? t("学習した単語", "학습한 단어")
            : t("学習した文字", "학습한 글자")}
        </p>
        <div className={styles.headline}>
          <strong>{number(summary.learned)}</strong>
          <span>{unit}</span>
        </div>
        <div className={styles.row}>
          <p className={styles.caption}>
            {t("一度以上答えた異なる項目", "한 번 이상 답한 서로 다른 항목")}
          </p>
          <span className={styles.tag}>
            {t("全", "전체 ")}
            {number(summary.total)}
            {unit}
          </span>
        </div>
        {summary.personal.total > 0 && (
          <p className={styles.caption}>
            {t("共通", "공통")} {number(summary.common.learned)} ·{" "}
            {t("個人", "개인")} {number(summary.personal.learned)}
          </p>
        )}
      </section>
      <div className={styles.twoColumns}>
        <section className={styles.card + " " + styles.reviewCard}>
          <p className={styles.label}>
            {t("いま復習する項目", "지금 복습할 항목")}
          </p>
          <strong className={styles.metric}>
            {number(summary.review)}
            <small> {unit}</small>
          </strong>
          <p className={styles.caption}>
            {t("復習候補に含まれる数", "복습 후보에 해당하는 수")}
          </p>
        </section>
        <section className={styles.card}>
          <p className={styles.label}>{t("累計回答", "누적 답변")}</p>
          <strong className={styles.metric}>
            {number(summary.attempts)}
            <small> {t("回", "회")}</small>
          </strong>
          <p className={styles.caption}>
            {t("正答・誤答・時間切れを含む", "정답·오답·시간 초과 포함")}
          </p>
        </section>
      </div>
    </>
  );
}
