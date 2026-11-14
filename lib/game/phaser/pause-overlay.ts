import type Phaser from "phaser";
import type { Preferences } from "../preferences";
import type { TrainingView } from "./board";
import type { BattleAudio } from "./battle-audio";
import { createSoundControls } from "./sound-settings";
import { pauseStyles } from "./pause-styles";

type PauseActions = {
  resume: () => void;
  finish: () => void;
  preferences: Preferences;
  changePreferences: (preferences: Preferences) => void;
  audio?: BattleAudio;
  toggleSound: () => void;
  /** @deprecated Sound controls are always expanded. */
  soundExpanded?: boolean;
  /** @deprecated Sound controls are always expanded. */
  setSoundExpanded?: (expanded: boolean) => void;
};

export function drawPause(view: TrainingView, actions: PauseActions): Phaser.GameObjects.Container {
  const overlay = view.add.container(0, 0).setDepth(100);
  overlay.add(view.add.rectangle(view.w / 2, view.h / 2, view.w, view.h, view.c.bg, .96).setInteractive());

  // Remove any orphaned DOM pause layer left by a suspended/recreated Phaser scene.
  document.querySelectorAll(".sokudoku-pause-root").forEach((node) => node.remove());
  const root = document.createElement("div");
  root.className = "sokudoku-pause-root";
  root.setAttribute("role", "presentation");
  const css = document.createElement("style");
  css.textContent = pauseStyles;
  const hex = (value: number) => "#" + value.toString(16).padStart(6, "0");
  const theme = view.c;
  root.style.setProperty("--ink", hex(theme.ink));
  root.style.setProperty("--muted", hex(theme.muted));
  root.style.setProperty("--line", hex(theme.line));
  root.style.setProperty("--panel", hex(theme.panel));
  root.style.setProperty("--shade", hex(theme.shade));
  root.style.setProperty("--track", hex(theme.line));
  root.style.setProperty("--blue", hex(theme.blue));
  root.style.setProperty("--blue-dark", hex(theme.blueDark));
  root.style.setProperty("--on-blue", hex(theme.onBrand));
  const card = document.createElement("section");
  card.className = "sokudoku-pause-card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-label", view.t("一時停止", "일시정지"));
  // The pause card is DOM while the game character normally lives on the Phaser canvas.
  // Reuse the same 4x5 sprite atlas directly in DOM to keep the resting character inside the card.
  const character = document.createElement("div");
  character.className = "sokudoku-pause-character";
  character.setAttribute("role", "img");
  character.setAttribute("aria-label", view.t("休んでいる仲間", "쉬고 있는 캐릭터"));
  const title = document.createElement("h2");
  title.textContent = view.t("ひと休み。", "잠시 쉬어가요.");
  const subtitle = document.createElement("p");
  subtitle.className = "sokudoku-pause-subtitle";
  subtitle.textContent = view.t("時間は止まっています", "시간은 멈춰 있습니다");
  const button = (text: string, action: () => void, className: string) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = className;
    el.textContent = text;
    el.onclick = () => {
      // Browser backgrounding can suspend Phaser while DOM remains interactive.
      // Release the DOM blocker synchronously, independent of the game loop.
      if (action === actions.resume || action === actions.finish) {
        root.remove();
        overlay.destroy();
      }
      action();
    };
    return el;
  };
  const header = document.createElement("div");
  header.className = "sokudoku-pause-header";
  const headerCopy = document.createElement("div");
  headerCopy.append(title, subtitle);
  header.append(character, headerCopy);
  card.append(
    header,
    button(view.t("つづける →", "계속하기 →"), actions.resume, "sokudoku-pause-main primary"),
  );
  const quick = document.createElement("div");
  quick.className = "sokudoku-pause-quick";
  quick.append(
    button(actions.preferences.theme === "light" ? view.t("☾ ダーク", "☾ 다크") : view.t("☀ ライト", "☀ 라이트"), () => {
      actions.changePreferences({ ...actions.preferences, theme: actions.preferences.theme === "light" ? "dark" : "light" });
    }, ""),
    button(actions.preferences.lang === "jp" ? "JP ⇄ KR" : "KR ⇄ JP", () => {
      actions.changePreferences({ ...actions.preferences, lang: actions.preferences.lang === "jp" ? "kr" : "jp" });
    }, ""),
    button(view.t("終了・保存", "종료·저장"), actions.finish, "pause-exit"),
  );
  card.append(quick);
  if (actions.audio) {
    card.append(createSoundControls(
      actions.audio,
      (jp, kr) => view.t(jp, kr),
      actions.preferences,
      actions.changePreferences,
      actions.toggleSound,
    ));
  }
  const readingSetting = document.createElement("div");
  readingSetting.className = "pause-reading-setting";
  const readingCopy = document.createElement("div");
  const readingTitle = document.createElement("strong");
  readingTitle.textContent = view.t("読み方のヒント", "읽는 법 힌트");
  const readingDescription = document.createElement("small");
  readingDescription.textContent = view.t("問題・復習に かな [韓国語発音] を表示", "문제·오답 카드에 가나 [한글 발음] 표시");
  readingCopy.append(readingTitle, readingDescription);
  const readingToggle = document.createElement("button");
  readingToggle.type = "button";
  const syncReading = (value: boolean) => {
    readingToggle.textContent = value ? view.t("オン", "켜짐") : view.t("オフ", "꺼짐");
    readingToggle.setAttribute("aria-pressed", String(value));
    readingToggle.setAttribute("aria-label", readingTitle.textContent + ": " + readingToggle.textContent);
  };
  syncReading(actions.preferences.showReadingHints);
  readingToggle.addEventListener("click", () => {
    const enabled = readingToggle.getAttribute("aria-pressed") !== "true";
    actions.preferences = { ...actions.preferences, showReadingHints: enabled };
    actions.changePreferences(actions.preferences);
    syncReading(enabled);
  });
  readingSetting.append(readingCopy, readingToggle);
  const correctReviewSetting = document.createElement("label");
  correctReviewSetting.className = "pause-correct-review-setting";
  const correctReviewTitle = document.createElement("strong");
  correctReviewTitle.textContent = view.t("正解したとき", "정답 후 진행");
  const correctReviewSelect = document.createElement("select");
  const reviewOptions = [
    { value: "instant", jp: "すぐ次の問題へ", kr: "바로 다음 문제" },
    { value: "card", jp: "正解カードを確認", kr: "정답 카드 확인" },
  ] as const;
  for (const option of reviewOptions) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = view.t(option.jp, option.kr);
    correctReviewSelect.append(element);
  }
  correctReviewSelect.value = actions.preferences.correctAnswerReview;
  correctReviewSelect.addEventListener("change", () => {
    const correctAnswerReview = correctReviewSelect.value === "card" ? "card" : "instant";
    actions.preferences = { ...actions.preferences, correctAnswerReview };
    actions.changePreferences(actions.preferences);
  });
  correctReviewSetting.append(correctReviewTitle, correctReviewSelect);
  card.append(correctReviewSetting, readingSetting);
  root.append(css, card);
  // PetMotion "rest" uses frames [19, 2] with a 1500ms step.
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const paintRest = (frame: number) => {
    character.style.backgroundPosition = `${(frame % 4) * 100 / 3}% ${Math.floor(frame / 4) * 25}%`;
  };
  paintRest(19);
  let restTimer: ReturnType<typeof setInterval> | undefined;
  if (!reducedMotion.matches) {
    let index = 0;
    restTimer = setInterval(() => {
      index = (index + 1) % 2;
      paintRest(index === 0 ? 19 : 2);
    }, 1500);
  }
  if (actions.audio) {
    actions.audio.preview = true;
    actions.audio.update(true, 16);
  }
  const align = () => {
    const rect = view.game.canvas.getBoundingClientRect();
    root.style.left = rect.left + "px";
    root.style.top = rect.top + "px";
    root.style.width = rect.width + "px";
    root.style.height = rect.height + "px";

  };
  document.body.append(root);
  align();
  window.addEventListener("resize", align);
  window.addEventListener("scroll", align, true);
  const cleanup = () => {
    window.removeEventListener("resize", align);
    window.removeEventListener("scroll", align, true);
    if (restTimer) clearInterval(restTimer);
    if (actions.audio) actions.audio.preview = false;
    root.remove();
  };
  overlay.once("destroy", cleanup);
  return overlay;
}
