"use client";
import { useState } from "react";
import type { dashboardSummary } from "@/lib/dashboard/summary";
import type { Translate } from "./dashboard-screen";
import styles from "./dashboard.module.css";
export function ActivityChart({
  summary,
  scope,
  t,
  lang,
}: {
  summary: ReturnType<typeof dashboardSummary>;
  scope: string;
  t: Translate;
  lang: string;
}) {
  const [selected, setSelected] = useState(6);
  const { days, week } = summary;
  const max = Math.max(1, ...days.map((d) => d.attempts));
  const active = days[selected];
  const locale = lang === "jp" ? "ja-JP" : "ko-KR";
  const date = (day: string, options: Intl.DateTimeFormatOptions) =>
    new Date(day + "T12:00:00Z").toLocaleDateString(locale, {
      ...options,
      timeZone: "UTC",
    });
  const accuracy = week.attempts
    ? Math.round((week.correct / week.attempts) * 100)
    : null;
  return (
    <section className={styles.card}>
      <div className={styles.sectionHeading}>
        <h2>{t("最近7日間", "최근 7일")}</h2>
        <span className={styles.tag}>{scope}</span>
      </div>
      <p className={styles.caption}>
        <b>
          {t("合計", "총 ")}
          {week.attempts.toLocaleString()}
          {t("回", "회")} · {days.filter((d) => d.attempts > 0).length}
          {t("日学習", "일 학습")}
        </b>
      </p>
      <div className={styles.dayDetail} aria-live="polite">
        <b>
          {date(active.day, {
            month: "long",
            day: "numeric",
            weekday: "short",
          })}
          {selected === 6 ? " · " + t("今日", "오늘") : ""}
        </b>
        <strong>
          {active.attempts.toLocaleString()}
          {t("回", "회")}
        </strong>
      </div>
      <div
        className={styles.chart}
        aria-label={t("日ごとの回答数", "날짜별 답변 수")}
      >
        {days.map((d, i) => (
          <button
            key={d.day}
            className={styles.dayColumn}
            aria-pressed={i === selected}
            aria-label={
              date(d.day, { month: "long", day: "numeric" }) +
              ": " +
              d.attempts +
              t("回", "회")
            }
            onClick={() => setSelected(i)}
          >
            <span className={styles.barTrack}>
              <span
                className={styles.bar}
                style={{
                  height: Math.max(3, (d.attempts / max) * 110),
                  background: i === selected ? "var(--accent)" : undefined,
                }}
              />
            </span>
            <span>{date(d.day, { weekday: "short" })}</span>
            <small>{i === 6 ? t("今日", "오늘") : " "}</small>
          </button>
        ))}
      </div>
      {!week.attempts && (
        <p className={styles.caption}>
          {t(
            "最近7日間の回答はありません。これまでの記憶状態は上に表示しています。",
            "최근 7일 답변이 없어요. 이전에 쌓은 기억 상태는 위에 표시돼요.",
          )}
        </p>
      )}
      <div className={styles.twoColumns}>
        <div className={styles.tile}>
          <p className={styles.label}>{t("正答率", "정답률")}</p>
          <strong className={styles.metric}>
            {accuracy ?? "—"}
            <small>{accuracy === null ? "" : "%"}</small>
          </strong>
          <div className={styles.progress}>
            <span
              style={{
                width: (accuracy ?? 0) + "%",
                background: "var(--dash-good)",
              }}
            />
          </div>
          <p className={styles.caption}>
            {week.correct} / {week.attempts}
          </p>
        </div>
        <div className={styles.tile}>
          <p className={styles.label}>
            {t("平均正答時間", "평균 정답 응답 시간")}
          </p>
          <strong className={styles.metric}>
            {week.correct
              ? (week.correct_ms / week.correct / 1000).toFixed(1)
              : "—"}
            <small>{week.correct ? t("秒", "초") : ""}</small>
          </strong>
          <p className={styles.caption}>
            {t("正答した回答だけを集計", "정답인 답변만 계산해요")}
          </p>
        </div>
      </div>
      <p className={styles.caption}>
        {t(
          "時間切れも正答率に含めます。応答時間は参考記録で、記憶状態には反映されません。",
          "시간 초과도 정답률 계산에 포함돼요. 응답 시간은 참고 기록으로, 기억 상태에는 반영되지 않아요.",
        )}
      </p>
    </section>
  );
}
