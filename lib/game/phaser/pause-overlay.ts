import type Phaser from "phaser";
import type { Preferences } from "../preferences";
import type { TrainingView } from "./board";

type PauseActions = {
  resume: () => void;
  finish: () => void;
  preferences: Preferences;
  changePreferences: (preferences: Preferences) => void;
  openSoundSettings: () => void;
};
function drawSettings(
  view: TrainingView,
  actions: PauseActions,
  parent: Phaser.GameObjects.Container,
) {
  const prefs = actions.preferences;
  view.button(
    prefs.lang === "jp" ? "JP ⇄ KR" : "KR ⇄ JP",
    view.w / 2 - 96,
    view.h / 2 + 150,
    88,
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
    view.w / 2,
    view.h / 2 + 150,
    88,
    () =>
      actions.changePreferences({
        ...prefs,
        theme: prefs.theme === "light" ? "dark" : "light",
      }),
    false,
    parent,
  );
  view.button(
    view.t("音設定", "소리 설정"),
    view.w / 2 + 96, view.h / 2 + 150, 88,
    actions.openSoundSettings, false, parent,
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
  const rabbit = view.createRestingRabbit(view.w / 2, view.h / 2 - 220, 100);
  overlay.add(rabbit.root);
  return overlay;
}
