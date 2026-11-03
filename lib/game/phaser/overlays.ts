import type Phaser from "phaser";
import type { Answer } from "../types";
import type { Preferences } from "../preferences";
import type { TrainingView } from "./board";

type PauseActions = {
  resume: () => void;
  finish: () => void;
  preferences: Preferences;
  changePreferences: (preferences: Preferences) => void;
};
type ResultData = {
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
  const x = view.w / 2,
    y = view.h / 2;
  view.box(
    x,
    y + 20,
    Math.min(view.cw, 500),
    Math.min(view.h - 40, 560),
    view.c.panel,
    28,
  );
  const correct = data.answers.filter((a) => a.result === "correct");
  const avg = correct.length
    ? Math.round(
        correct.reduce((s, a) => s + a.response_ms, 0) / correct.length,
      )
    : null;
  view.text(
    x,
    y - 220,
    data.reviewComplete
      ? view.t("いまの復習は完了です", "지금 할 복습을 완료했어요")
      : view.t("おつかれさまでした", "수고했어요"),
    14,
    view.c.blue,
  );
  view.text(x, y - 160, String(correct.length), 72);
  view.text(x, y - 104, view.t("正答", "정답"), 13, view.c.muted);
  view.text(
    x,
    y - 48,
    `${view.t("正答率", "정답률")}  ${data.answers.length ? Math.round((correct.length / data.answers.length) * 100) : 0}%    /    ${avg ?? "—"} ms`,
    17,
  );
  view.text(
    x,
    y - 8,
    `${view.t("不正解", "오답")} ${data.answers.filter((a) => a.result === "incorrect").length}    ${view.t("時間切れ", "시간 초과")} ${data.answers.filter((a) => a.result === "timeout").length}`,
    14,
    view.c.muted,
  );
  const state = data.preview
    ? view.t("プレビュー · 保存しません", "미리보기 · 저장하지 않습니다")
    : data.syncing
      ? view.t("記録を保存中…", "기록 저장 중…")
      : data.syncOK
        ? view.t("記録を保存しました ✓", "기록 저장 완료 ✓")
        : view.t(
            "保存できませんでした。この画面で再試行できます",
            "저장하지 못했습니다. 이 화면에서 재시도할 수 있어요",
          );
  view.text(
    x, y + 46, state, 13,
    data.syncOK ? view.c.green : data.syncing ? view.c.blue : view.c.muted,
  );
  if (data.syncing)
    view.text(
      x, y + 72,
      view.t("保存が終わるまでお待ちください。", "저장이 끝날 때까지 잠시 기다려주세요."),
      12, view.c.muted,
    );
  if (data.reviewComplete && !data.syncing)
    view.text(
      x,
      y + 72,
      view.t(
        "次の復習時期まで、探索で学びましょう。",
        "다음 복습 시점까지 탐색으로 학습해보세요.",
      ),
      12,
      view.c.muted,
    );
  view.button(
    data.reviewComplete
      ? view.t("ホームへ →", "메인으로 →")
      : view.t("もう一度 →", "다시 하기 →"),
    x,
    y + 108,
    280,
    data.reviewComplete
      ? () => {
          if (!data.syncing) actions.exit();
        }
      : actions.retry,
    true,
    undefined,
    data.syncing,
  );
  if (!data.reviewComplete)
    view.button(
      view.t("ホームへ", "홈으로"), x, y + 169, 280,
      actions.exit, false, undefined, data.syncing,
    );
  if (!data.syncOK && !data.syncing && !data.preview)
    view.button(
      view.t("同期を再試行", "동기화 재시도"),
      x,
      y + 229,
      200,
      actions.sync,
    );
}
