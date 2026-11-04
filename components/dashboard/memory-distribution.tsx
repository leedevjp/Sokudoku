"use client";
import { useState } from "react";
import { percentageShares } from "@/lib/dashboard/summary";
import type { Translate } from "@/lib/dashboard/types";
import styles from "./dashboard-styles";
export function MemoryDistribution({
  counts,
  scope,
  t,
}: {
  counts: number[];
  scope: string;
  t: Translate;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [help, setHelp] = useState(false);
  const total = counts.reduce((a, b) => a + b, 0);
  const percentages = percentageShares(counts);
  const labels = [
    t("学習を始めたところ", "처음 학습 중"),
    t("覚えつつある", "익숙해지는 중"),
    t("長く覚えている項目", "오래 기억하는 항목"),
  ];
  return (
    <section className={styles.card}>
      <div className={styles.sectionHeading}>
        <h2>{t("記憶の状態", "기억 상태")}</h2>
        <button
          className={styles.help}
          onClick={() => setHelp(!help)}
          aria-expanded={help}
          aria-controls="memory-help"
          aria-label={t("分類の説明", "기억 상태 분류 설명")}
        >
          ?
        </button>
        <span className={styles.tag}>{scope}</span>
      </div>
      <p className={styles.caption}>
        {t(
          "学習記録から推定した記憶の状態です。",
          "학습 기록을 바탕으로 추정한 기억 상태예요.",
        )}
      </p>
      {help && (
        <div className={styles.helpBox} id="memory-help">
          <p>
            {t(
              "長期的な記憶の安定性をもとに、7日未満・7〜21日未満・21日以上の3段階に分けます。最後に間違えた項目は最初のグループに含めます。",
              "장기 기억 안정성을 7일 미만·7~21일 미만·21일 이상의 세 구간으로 나눠요. 마지막에 틀린 항목은 첫 그룹에 포함해요.",
            )}
          </p>
          <p>
            {t(
              "永久に覚えたことや、いま必ず答えられることを保証するものではありません。",
              "영구 암기나 지금 반드시 정답을 맞힌다는 뜻은 아니에요.",
            )}
          </p>
        </div>
      )}
      <div className={styles.memoryBar} aria-hidden="true">
        {counts.map(
          (n, i) =>
            n > 0 && (
              <span
                key={i}
                className={styles["memory" + i]}
                style={{
                  flex: n,
                  opacity: selected === null || selected === i ? 1 : 0.25,
                }}
              />
            ),
        )}
      </div>
      <div>
        {counts.map((n, i) => (
          <button
            key={i}
            className={styles.memoryRow}
            aria-pressed={selected === i}
            onClick={() => setSelected(selected === i ? null : i)}
          >
            <i className={styles["memory" + i]} />
            <span>{labels[i]}</span>
            <b>{n.toLocaleString()}</b>
            <small>{percentages[i]}%</small>
          </button>
        ))}
      </div>
      <p className={styles.totalLine}>
        {t("合計", "합계 ")}
        {total.toLocaleString()} ·{" "}
        {t("学習した項目数と一致します。", "학습한 항목 수와 같아요.")}
      </p>
    </section>
  );
}
