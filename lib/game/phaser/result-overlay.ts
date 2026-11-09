import type { Answer } from "../types";
import type { TrainingView } from "./board";
import type { TrainingPlanner } from "../learning/planner";

type ResultData = {
  progress: ReturnType<TrainingPlanner["progress"]>;
  reviewComplete?: boolean;
  answers: Answer[];
  preview?: boolean;
  syncing: boolean;
  syncOK: boolean | null;
};
type ResultActions = { retry: () => void; sync: () => void; exit: () => void; exam: () => void };

export function drawEnd(
  view: TrainingView,
  data: ResultData,
  actions: ResultActions,
) {
  const x = view.w / 2,
    y = view.h / 2;
  const s = Math.min(1, (view.h - 32) / 680);
  const width = Math.min(view.w - 32, 500);
  const label = (offset: number, text: string, size = 16, color = view.c.ink) =>
    view
      .designText(x, y + offset * s, text, Math.max(13, size * s), color)
      .setWordWrapWidth(width - 32, true);
  view.box(x, y, width, 680 * s, view.c.panel, 28);
  const correct = data.answers.filter((a) => a.result === "correct");
  const timedCorrect = correct.filter((a) => a.response_ms !== null);
  const average = timedCorrect.length
    ? Math.round(timedCorrect.reduce((sum, a) => sum + a.response_ms!, 0) / timedCorrect.length)
    : null;
  label(
    -290,
    data.reviewComplete
      ? view.t(
          "今回の学習は完了しました！",
          "이번 학습을 완료했어요!",
        )
      : view.t("おつかれさまでした", "수고했어요"),
    17,
    view.c.blue,
  );
  label(-225, String(correct.length), 64);
  label(-180, view.t("正答", "정답"), 14, view.c.muted);
  label(
    -145,
    `${view.t("正答率", "정답률")} ${data.answers.length ? Math.round((correct.length / data.answers.length) * 100) : 0}%  /  ${average ?? "—"} ms`,
  );
  label(
    -112,
    `${view.t("不正解", "오답")} ${data.answers.filter((a) => a.result === "incorrect").length}  ·  ${view.t("時間切れ", "시간초과")} ${data.answers.filter((a) => a.result === "timeout").length}`,
    14,
    view.c.muted,
  );
  const newWords = new Set(
    data.answers
      .filter((a) => a.mode === "exploration")
      .map((a) => `${a.source ?? "word"}:${a.word_id}`),
  ).size;
  const reviews = data.answers.filter((a) => a.mode === "review").length;
  const exams = data.answers.filter((a) => a.mode === "exam").length;
  label(
    -72,
    exams
      ? view.t(
          `テスト ${exams}問 · 学習記録に反映`,
          `시험 ${exams}문제 · 학습 기록에 반영`,
        )
      : view.t(
          `新しく学んだ単語 ${newWords}語 · 復習 ${reviews}問`,
          `새로 만난 단어 ${newWords}개 · 복습 ${reviews}문제`,
        ),
    17,
    view.c.blue,
  );
  label(
    -34,
    view.t(
      `未探索 ${data.progress.unseen}語 · 今の復習 ${data.progress.review}語`,
      `남은 탐색 ${data.progress.unseen}개 · 지금 복습 ${data.progress.review}개`,
    ),
    16,
  );
  const nextDue =
    data.progress.review > 0
      ? view.t("今すぐ復習できる単語があります", "지금 복습할 단어가 있어요")
      : data.progress.nextDue
        ? view.t("次の復習: ", "다음 복습: ") +
          new Date(data.progress.nextDue).toLocaleString(
            view.prefs.lang === "jp" ? "ja-JP" : "ko-KR",
            {
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            },
          )
        : view.t("次の復習予定はありません", "예정된 다음 복습이 없어요");
  label(4, data.progress.nextDue && data.progress.nextDue <= Date.now() && data.progress.review === 0
    ? view.t("復習予定を更新しています", "복습 일정을 확인하고 있어요")
    : nextDue, 14, view.c.muted);
  const state = data.preview
    ? view.t("プレビュー · 保存しません", "미리보기 · 저장하지 않습니다")
    : data.syncing
      ? view.t("記録を保存中…", "기록 저장 중…")
      : data.syncOK
        ? view.t("記録を保存しました ✓", "기록 저장 완료 ✓")
        : view.t(
            "保存できませんでした。同期を再試行してください",
            "저장하지 못했어요. 동기화를 다시 시도해주세요",
          );
  label(56, state, 16, data.syncOK ? view.c.green : view.c.muted);
  if (data.reviewComplete) {
    label(
      93,
      view.t(
        "探索・復習の出題が今はありません。",
        "탐색할 단어와 지금 복습할 단어가 없어요.",
      ),
      14,
      view.c.muted,
    );
    label(
      126,
      view.t(
        "もっと学ぶなら、テストモードで学習済みの単語をもう一度解けます。",
        "더 공부하고 싶나요? 시험 모드에서는 배운 단어를 다시 풀 수 있어요.",
      ),
      14,
      view.c.ink,
    );
  }
  const buttonWidth = Math.min(280, width - 48);
  if (data.reviewComplete) {
    view.button(
      view.t("テストモードで続ける →", "시험 모드로 계속 공부하기 →"),
      x, y + 202 * s, buttonWidth, actions.exam, true, undefined, data.syncing || (!data.preview && !data.syncOK),
    );
    view.button(
      view.t("ホームへ", "메인으로"),
      x, y + 262 * s, buttonWidth, actions.exit, false, undefined, data.syncing || (!data.preview && !data.syncOK),
    );
  } else {
    view.button(
      view.t("もう一度 →", "다시 하기 →"),
      x, y + 150 * s, buttonWidth, actions.retry, true, undefined, data.syncing,
    );
    view.button(
      view.t("ホームへ", "홈으로"),
      x, y + 212 * s, buttonWidth, actions.exit, false, undefined, data.syncing,
    );
  }
  if (!data.syncOK && !data.syncing && !data.preview)
    view.button(
      view.t("同期を再試行", "동기화 재시도"),
      x,
      y + (data.reviewComplete ? 310 : 274) * s,
      buttonWidth,
      actions.sync,
    );
}
