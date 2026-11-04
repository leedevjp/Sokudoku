import type Phaser from "phaser";
import type { Answer } from "../types";
import type { Preferences } from "../preferences";
import type { TrainingView } from "./board";
import type { TrainingPlanner } from "../learning/planner";

type PauseActions = {
  resume: () => void;
  finish: () => void;
  preferences: Preferences;
  changePreferences: (preferences: Preferences) => void;
};
type ResultData = {
  progress: ReturnType<TrainingPlanner["progress"]>;
  reviewComplete?: boolean;
  answers: Answer[];
  preview?: boolean;
  syncing: boolean;
  syncOK: boolean | null;
};
type ResultActions = { retry: () => void; sync: () => void; exit: () => void };

function drawSettings(
  view: TrainingView,
  actions: PauseActions,
  parent: Phaser.GameObjects.Container,
) {
  const prefs = actions.preferences;
  view.button(
    prefs.lang === "jp" ? "JP ⇄ KR" : "KR ⇄ JP",
    view.w / 2 - 72,
    view.h / 2 + 150,
    130,
    () =>
      actions.changePreferences({
        ...prefs,
        lang: prefs.lang === "jp" ? "kr" : "jp",
      }),
    false,
    parent,
  );
  view.button(
    prefs.theme === "light"
      ? view.t("☾ ダーク", "☾ 다크")
      : view.t("☀ ライト", "☀ 라이트"),
    view.w / 2 + 72,
    view.h / 2 + 150,
    130,
    () =>
      actions.changePreferences({
        ...prefs,
        theme: prefs.theme === "light" ? "dark" : "light",
      }),
    false,
    parent,
  );
}

export function drawPause(view: TrainingView, actions: PauseActions) {
  const overlay = view.add.container(0, 0).setDepth(100);
  overlay.add(
    view.add
      .rectangle(view.w / 2, view.h / 2, view.w, view.h, view.c.bg, 0.96)
      .setInteractive(),
  );
  overlay.add(
    view.box(
      view.w / 2,
      view.h / 2 + 22,
      Math.min(view.cw, 440),
      340,
      view.c.panel,
      26,
    ),
  );
  overlay.add(
    view.designText(
      view.w / 2,
      view.h / 2 - 100,
      view.t("ひと休み。", "잠시 쉬어가요."),
      Math.max(25, 30 * view.factor),
      view.c.ink,
      true,
    ),
  );
  overlay.add(
    view.designText(
      view.w / 2,
      view.h / 2 - 45,
      view.t("時間は止まっています", "시간은 멈춰 있습니다"),
      15,
      view.c.muted,
    ),
  );
  view.button(
    view.t("つづける →", "계속하기 →"),
    view.w / 2,
    view.h / 2 + 20,
    260,
    actions.resume,
    true,
    overlay,
  );
  view.button(
    view.t("終了して保存", "종료하고 저장"),
    view.w / 2,
    view.h / 2 + 82,
    260,
    actions.finish,
    false,
    overlay,
  );
  drawSettings(view, actions, overlay);
  return overlay;
}

export function drawEnd(
  view: TrainingView,
  data: ResultData,
  actions: ResultActions,
) {
  const x = view.w / 2, y = view.h / 2;
  const s = Math.min(1, (view.h - 32) / 680);
  const width = Math.min(view.w - 32, 500);
  const label = (offset: number, text: string, size = 16, color = view.c.ink) =>
    view.designText(x, y + offset * s, text, Math.max(13, size * s), color)
      .setWordWrapWidth(width - 32, true);
  view.box(x, y, width, 680 * s, view.c.panel, 28);
  const correct = data.answers.filter((a) => a.result === "correct");
  const average = correct.length
    ? Math.round(correct.reduce((sum, a) => sum + a.response_ms, 0) / correct.length)
    : null;
  label(-290, data.reviewComplete
    ? view.t("選択した学習は今のところ完了です", "선택한 학습을 지금은 모두 마쳤어요")
    : view.t("おつかれさまでした", "수고했어요"), 17, view.c.blue);
  label(-225, String(correct.length), 64);
  label(-180, view.t("正答", "정답"), 14, view.c.muted);
  label(-145, `${view.t("正答率", "정답률")} ${data.answers.length ? Math.round(correct.length / data.answers.length * 100) : 0}%  /  ${average ?? "—"} ms`);
  label(-112, `${view.t("不正解", "오답")} ${data.answers.filter(a => a.result === "incorrect").length}  ·  ${view.t("時間切れ", "시간초과")} ${data.answers.filter(a => a.result === "timeout").length}`, 14, view.c.muted);
  const newWords = new Set(data.answers.filter(a => a.mode === "exploration").map(a => `${a.source ?? "word"}:${a.word_id}`)).size;
  const reviews = data.answers.filter(a => a.mode === "review").length;
  label(-72, view.t(`新しく学んだ単語 ${newWords}語 · 復習 ${reviews}問`, `새로 만난 단어 ${newWords}개 · 복습 ${reviews}문제`), 17, view.c.blue);
  label(-34, view.t(`未探索 ${data.progress.unseen}語 · 今の復習 ${data.progress.review}語`, `남은 탐색 ${data.progress.unseen}개 · 지금 복습 ${data.progress.review}개`), 16);
  const nextDue = data.progress.review > 0
    ? view.t("今すぐ復習できる単語があります", "지금 복습할 단어가 있어요")
    : data.progress.nextDue
      ? view.t("次の復習: ", "다음 복습: ") + new Date(data.progress.nextDue).toLocaleString(view.prefs.lang === "jp" ? "ja-JP" : "ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
      : view.t("次の復習予定はありません", "예정된 다음 복습이 없어요");
  label(4, nextDue, 14, view.c.muted);
  const state = data.preview
    ? view.t("プレビュー · 保存しません", "미리보기 · 저장하지 않습니다")
    : data.syncing
      ? view.t("記録を保存中…", "기록 저장 중…")
      : data.syncOK
        ? view.t("記録を保存しました ✓", "기록 저장 완료 ✓")
        : view.t("保存できませんでした。同期を再試行してください", "저장하지 못했어요. 동기화를 다시 시도해주세요");
  label(56, state, 16, data.syncOK ? view.c.green : view.c.muted);
  if (data.reviewComplete)
    label(94, data.progress.review > 0
      ? view.t("復習を選ぶと、続けて学べます。", "복습을 선택하면 이어서 학습할 수 있어요.")
      : data.progress.unseen > 0
        ? view.t("探索を選ぶと、新しい単語を学べます。", "탐색을 선택하면 새 단어를 학습할 수 있어요.")
        : view.t("次の復習時期になったら、また学びましょう。", "다음 복습 시각이 되면 다시 학습하세요."), 14, view.c.muted);
  const buttonWidth = Math.min(280, width - 48);
  view.button(data.reviewComplete ? view.t("ホームへ →", "메인으로 →") : view.t("もう一度 →", "다시 하기 →"), x, y + 150 * s, buttonWidth,
    data.reviewComplete ? actions.exit : actions.retry, true, undefined, data.syncing);
  if (!data.reviewComplete)
    view.button(view.t("ホームへ", "홈으로"), x, y + 212 * s, buttonWidth, actions.exit, false, undefined, data.syncing);
  if (!data.syncOK && !data.syncing && !data.preview)
    view.button(view.t("同期を再試行", "동기화 재시도"), x, y + 274 * s, buttonWidth, actions.sync);
}
