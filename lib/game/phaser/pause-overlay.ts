import type Phaser from "phaser";
import type { Preferences } from "../preferences";
import type { TrainingView } from "./board";
import type { BattleAudio } from "./battle-audio";
import { createSoundControls } from "./sound-settings";

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
  css.textContent = `
.sokudoku-pause-root{position:fixed;z-index:1000;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:auto;padding:10px;font-family:system-ui,-apple-system,sans-serif;color:var(--ink)}
.sokudoku-pause-root *{box-sizing:border-box}
.sokudoku-pause-card{position:relative;width:min(440px,100%);flex:0 1 auto;min-height:0;max-height:100%;overflow-y:auto;overscroll-behavior:contain;border:1.5px solid var(--line);border-radius:24px;padding:16px 18px 18px;background:var(--panel);box-shadow:0 6px 0 var(--shade);text-align:center;scrollbar-width:thin}
.sokudoku-pause-header{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:12px;text-align:left}
.sokudoku-pause-character{width:64px;height:64px;flex:none;background-image:url("/battle/mage-v5.png");background-size:400% 500%;background-repeat:no-repeat;image-rendering:pixelated;pointer-events:none}
.sokudoku-pause-card h2{font-size:22px;margin:0 0 2px;font-weight:800;line-height:1.25;letter-spacing:-.02em;color:var(--ink)}
.sokudoku-pause-subtitle{font-size:12px;color:var(--muted);margin:0}
.sokudoku-pause-card button,.sokudoku-pause-card select{font:inherit;cursor:pointer;touch-action:manipulation}
.sokudoku-pause-main{display:block;width:100%;height:48px;margin:0 0 10px;border-radius:14px;border:1.5px solid var(--line);font-size:16px;font-weight:800!important;color:var(--ink);background:var(--panel);box-shadow:0 4px 0 var(--shade);transition:transform .08s,box-shadow .08s}
.sokudoku-pause-main.primary{background:var(--blue);color:var(--on-blue);border-color:var(--blue-dark);box-shadow:0 4px 0 var(--blue-dark)}
.sokudoku-pause-main:active,.sokudoku-pause-quick button:active{transform:translateY(3px);box-shadow:none}
.sokudoku-pause-quick{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:0}
.sokudoku-pause-quick button{width:100%;min-width:0;height:42px;padding:0 3px;background:var(--panel);border:1.5px solid var(--line);color:var(--ink);border-radius:12px;box-shadow:0 3px 0 var(--shade);font-size:12px;font-weight:700;transition:transform .08s,box-shadow .08s}
.pause-sound-controls{display:grid;gap:9px;margin-top:14px;padding-top:12px;border-top:1.5px dashed var(--line);text-align:left}
.pause-sound-heading{display:flex;align-items:center;justify-content:space-between;gap:10px}
.pause-sound-heading strong{font-size:14px;font-weight:800;color:var(--ink)}
.pause-sound-heading button{min-height:30px;padding:0 10px;border:1.5px solid var(--line);border-radius:999px;background:var(--panel);color:var(--blue);font-size:11px;font-weight:700}
.pause-sound-heading button[aria-pressed=true]{color:var(--muted)}
.pause-sound-slider{display:grid;grid-template-columns:66px minmax(0,1fr) 88px;align-items:center;gap:10px;min-height:36px;font-size:13px;font-weight:700;color:var(--ink)}
.pause-slider-caption{display:contents}
.pause-slider-caption>span:first-child{white-space:nowrap}
.pause-slider-side{display:flex;align-items:center;justify-content:flex-start;gap:6px;width:88px;min-width:88px}
.pause-slider-caption output{display:inline-block;width:42px;min-width:42px;text-align:right;font-variant-numeric:tabular-nums;color:var(--blue);font-weight:800;font-size:12px}
.pause-preview{width:28px;height:28px;padding:0;display:grid;place-items:center;border:1.5px solid var(--line);background:var(--panel);border-radius:9px;color:var(--blue);font-size:11px;box-shadow:0 2px 0 var(--shade)}
.pause-preview:active{transform:translateY(2px);box-shadow:none}
.pause-sound-slider input[type=range]{-webkit-appearance:none!important;appearance:none!important;display:block!important;box-sizing:border-box!important;width:100%!important;height:28px!important;min-height:28px!important;max-height:28px!important;margin:0!important;padding:0!important;border:0!important;border-radius:999px!important;box-shadow:none!important;outline:0!important;cursor:pointer;touch-action:pan-y;--fillpos:calc(100% * var(--p,0));background:linear-gradient(to right,var(--blue) 0,var(--blue) var(--fillpos),var(--track) var(--fillpos),var(--track) 100%) center/100% 7px no-repeat!important}
.pause-sound-slider input[type=range]::-webkit-slider-runnable-track{height:28px!important;border:0!important;background:transparent!important}
.pause-sound-slider input[type=range]::-moz-range-track{height:28px!important;border:0!important;background:transparent!important}
.pause-sound-slider input[type=range]::-webkit-slider-thumb{-webkit-appearance:none!important;appearance:none!important;width:14px!important;height:24px!important;border-radius:7px!important;border:2px solid var(--blue)!important;background:var(--panel)!important;box-shadow:0 1px 2px var(--shade)!important}
.pause-sound-slider input[type=range]::-moz-range-thumb{width:14px!important;height:24px!important;border-radius:7px!important;border:2px solid var(--blue)!important;background:var(--panel)!important}
.pause-sound-slider input[type=range]:focus-visible{outline:2px solid var(--blue)!important;outline-offset:2px!important}
.pause-select-grid{display:grid;grid-template-rows:repeat(2,44px);gap:8px;margin-top:5px;padding-top:12px;border-top:1.5px dashed var(--line)}
.pause-select-row,.pause-correct-review-setting{display:grid;grid-template-columns:minmax(100px,1fr) minmax(0,1.5fr);align-items:center;gap:10px;min-width:0;text-align:left;font-size:13px;font-weight:700;color:var(--ink)}
.pause-select-row{min-height:44px;height:44px}
.pause-select-row select,.pause-correct-review-setting select{width:100%;min-width:0;height:40px;border:1.5px solid var(--line);border-radius:11px;padding:0 9px;color:var(--ink);background:var(--panel);font-size:12px;font-weight:700}
.pause-correct-review-setting{min-height:57px;margin-top:8px;padding-top:12px;border-top:1.5px dashed var(--line)}
.pause-correct-review-setting strong,.pause-reading-setting strong{font-size:13px;font-weight:800;color:var(--ink)}
.pause-reading-setting{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:44px;height:44px;margin-top:8px;text-align:left}
.pause-reading-setting button{flex:none;min-width:62px;height:36px;border:1.5px solid var(--line);border-radius:999px;padding:0 12px;font-size:12px;font-weight:800;background:var(--panel);color:var(--muted)}
.pause-reading-setting button[aria-pressed=true]{background:var(--blue);color:var(--on-blue);border-color:var(--blue-dark)}
@media(max-width:359px){.sokudoku-pause-card{padding:12px}.pause-sound-slider{grid-template-columns:54px minmax(0,1fr) 88px;gap:5px}.pause-select-row,.pause-correct-review-setting{grid-template-columns:minmax(80px,1fr) minmax(0,1.5fr);gap:6px}}
@media(max-height:700px){.sokudoku-pause-card{padding:11px 14px}.sokudoku-pause-header{margin-bottom:8px}.sokudoku-pause-character{height:50px;width:50px}.sokudoku-pause-main{height:42px;margin-bottom:8px}.sokudoku-pause-quick button{height:36px}.pause-sound-controls{gap:5px;margin-top:10px;padding-top:9px}.pause-sound-slider{min-height:32px}.pause-select-grid{gap:8px}.pause-select-row select,.pause-correct-review-setting select{height:36px}.pause-correct-review-setting{margin-top:8px;padding-top:8px}}
`;
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
    button(view.t("終了・保存", "종료·저장"), actions.finish, ""),
    button(actions.preferences.lang === "jp" ? "JP ⇄ KR" : "KR ⇄ JP", () => {
      actions.changePreferences({ ...actions.preferences, lang: actions.preferences.lang === "jp" ? "kr" : "jp" });
    }, ""),
    button(actions.preferences.theme === "light" ? view.t("☾ ダーク", "☾ 다크") : view.t("☀ ライト", "☀ 라이트"), () => {
      actions.changePreferences({ ...actions.preferences, theme: actions.preferences.theme === "light" ? "dark" : "light" });
    }, ""),
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
  readingCopy.append(readingTitle);
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
