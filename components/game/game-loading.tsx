"use client";
import Link from "next/link";
import { TrainingGuide } from "./training-guide";
import type { Lang } from "@/lib/game/preferences";

export function GameLoading({ error, lang }: { error: string; lang: Lang }) {
  const t = (jp: string, kr: string) => (lang === "jp" ? jp : kr);
  return (
    <div className="game-loading">
      <strong>速読 / Sokudoku</strong>
      <p role="status">
        {error
          ? error === "START"
            ? t(
                "ゲームを開始できませんでした。ホームからもう一度お試しください。",
                "게임을 시작하지 못했어요. 메인으로 돌아가 다시 시작해주세요.",
              )
            : error === "QUESTION_BUILD_FAILED"
              ? t(
                  "候補はありますが、重複しない4択を作れませんでした。範囲を広げるか単語の意味を確認してください。",
                  "남은 단어는 있지만 겹치지 않는 4지선다를 만들지 못했어요. 범위를 넓히거나 단어 뜻을 확인해주세요.",
                )
              : error === "REVIEW_EMPTY"
                ? t(
                    "いま復習する単語はありません。探索で学習するか、時間をおいてお試しください。",
                    "지금 복습할 단어가 없어요. 탐색으로 학습하거나 나중에 다시 시도해주세요.",
                  )
                : error === "MODES"
                  ? t(
                      "探索・復習を選んでください。",
                      "탐색·복습을 선택해주세요.",
                    )
                  : error === "KINDS"
                    ? t(
                        "問題タイプを選んでください。",
                        "문제 유형을 선택해주세요.",
                      )
                    : error === "WORDS"
                      ? t(
                          "選択した範囲・問題タイプには少なくとも4語必要です。読み方には漢字を含む単語を使います。",
                          "선택한 범위·유형에 단어가 최소 4개 필요합니다. 읽기에는 한자가 있는 단어를 사용합니다.",
                        )
                      : t(
                          "接続を確認して、もう一度お試しください。",
                          "연결을 확인하고 다시 시도해주세요.",
                        )
          : t("トレーニングを準備中…", "훈련 준비 중…")}
      </p>
      {!error && <TrainingGuide lang={lang} />}
      {error && <Link href="/">{t("ホームへ", "홈으로")}</Link>}
    </div>
  );
}
