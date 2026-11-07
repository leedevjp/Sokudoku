import type { dashboardSummary } from "@/lib/dashboard/summary";
import type { EntryType } from "@/lib/game/types";
import type { Translate } from "@/lib/dashboard/types";
import styles from "./dashboard-styles";
import { CompanionIntro } from "./dashboard-companion";
export function StageProgress({
  summary,
  entry,
  scope,
  t,
}: {
  summary: ReturnType<typeof dashboardSummary>;
  entry: EntryType;
  scope: string;
  t: Translate;
}) {
  const levels =
    entry === "word" ? ["1", "2", "3", "4", "5", "P"] : ["kana", "P"];
  return (
    <section className={styles.card} data-companion-section="stages">
      <CompanionIntro section="stages" tag={scope}
        title={entry === "word" ? t("段階ごとの状況", "단계별 현황") : t("文字の学習状況", "글자 학습 현황")}
        caption={t("学習した数 / 学習できる全項目", "학습한 개수 / 학습 가능한 전체 개수")} />
      {levels.map((level) => {
        const groups = summary.groups.filter((g) =>
          level === "kana" ? g.level !== "P" : g.level === level,
        );
        const total = groups.reduce((n, g) => n + g.total, 0),
          learned = groups.reduce((n, g) => n + g.learned, 0);
        const counts = [0, 1, 2].map((i) =>
          groups.reduce((n, g) => n + g.memory[i], 0),
        );
        const label =
          level === "P"
            ? t("個人単語 P", "개인 단어 P")
            : level === "kana"
              ? scope
              : level + t("段階", "단계");
        return (
          <details className={styles.stage} key={level} data-companion-level={level}>
            <summary>
              <span className={styles.badge}>
                {level === "kana"
                  ? entry === "hiragana"
                    ? "あ"
                    : "ア"
                  : level}
              </span>
              <div className={styles.stageBody}>
                <div className={styles.row}>
                  <b>{label}</b>
                  <span>
                    <b>{learned.toLocaleString()}</b> / {total.toLocaleString()}
                  </span>
                </div>
                <div className={styles.progress}>
                  <span
                    style={{
                      width: (total ? (learned / total) * 100 : 0) + "%",
                    }}
                  />
                </div>
              </div>
              <span className={styles.chevron}>⌄</span>
            </summary>
            <div className={styles.stageDetails}>
              {total === 0 ? (
                <p>
                  {t("登録された項目がありません。", "등록된 항목이 없어요.")}
                </p>
              ) : (
                <>
                  <p>
                    {t("まだ学習していない項目：", "아직 학습하지 않은 항목: ")}
                    {(total - learned).toLocaleString()}
                  </p>
                  {[
                    t("学習を始めたところ", "처음 학습 중"),
                    t("覚えつつある", "익숙해지는 중"),
                    t("長く覚えている項目", "오래 기억하는 항목"),
                  ].map((name, i) => (
                    <div className={styles.row} key={name}>
                      <span>{name}</span>
                      <b>{counts[i].toLocaleString()}</b>
                    </div>
                  ))}
                </>
              )}
            </div>
          </details>
        );
      })}
      {summary.personal.total > 0 && (
        <p className={styles.caption}>
          {t(
            "個人単語は共通単語の段階別集計に含めません。",
            "개인 단어는 공통 단어의 단계별 집계와 구분해요.",
          )}
        </p>
      )}
    </section>
  );
}
