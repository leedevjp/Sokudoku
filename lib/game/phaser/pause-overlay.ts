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

  const root = document.createElement("div");
  root.className = "sokudoku-pause-root";
  root.setAttribute("role", "presentation");
  const css = document.createElement("style");
  css.textContent = `
.sokudoku-pause-root{position:fixed;z-index:1000;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:auto;padding:12px;font-family:system-ui,-apple-system,sans-serif;color:var(--ink)}
.sokudoku-pause-root *{box-sizing:border-box}
.sokudoku-pause-character{width:90px;height:90px;margin:0 auto 4px;flex:none;background-image:url("/battle/mage-v5.png");background-size:400% 500%;background-repeat:no-repeat;image-rendering:pixelated;pointer-events:none}
.sokudoku-pause-card{position:relative;width:min(420px,100%);flex:0 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;border:1.5px solid var(--line);border-radius:28px;padding:22px 20px 20px;background:var(--panel);box-shadow:0 6px 0 var(--shade);text-align:center;scrollbar-width:none}
.sokudoku-pause-card::-webkit-scrollbar{display:none}
.sokudoku-pause-card h2{font-size:clamp(22px,5vw,28px);margin:0 0 4px;font-weight:800;line-height:1.3;letter-spacing:-.02em;color:var(--ink)}
.sokudoku-pause-subtitle{font-size:13px;color:var(--muted);margin:0 0 18px}
.sokudoku-pause-card button,.sokudoku-pause-card select{font:inherit;cursor:pointer;touch-action:manipulation}
.sokudoku-pause-main{display:block;width:100%;min-height:52px;margin:0 0 10px;border-radius:16px;border:1.5px solid var(--line);font-size:16px;font-weight:800!important;color:var(--ink);background:var(--panel);box-shadow:0 4px 0 var(--shade);transition:transform .08s,box-shadow .08s}
.sokudoku-pause-main.primary{background:var(--blue);color:var(--on-blue);border-color:var(--blue-dark);box-shadow:0 4px 0 var(--blue-dark)}
.sokudoku-pause-main:active,.sokudoku-pause-quick button:active{transform:translateY(3px);box-shadow:none}
.sokudoku-pause-quick{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px}
.sokudoku-pause-quick button{width:100%;min-height:44px;padding:0 10px;background:var(--panel);border:1.5px solid var(--line);color:var(--ink);border-radius:14px;box-shadow:0 3px 0 var(--shade);font-size:14px;font-weight:700;transition:transform .08s,box-shadow .08s}
.pause-sound-controls{display:grid;gap:14px;margin-top:18px;padding-top:16px;border-top:1.5px dashed var(--line);text-align:left}
.pause-sound-heading{display:flex;align-items:center;justify-content:space-between;gap:10px}
.pause-sound-heading strong{font-size:14px;font-weight:800;color:var(--ink)}
.pause-sound-heading button{min-height:32px;padding:0 12px;border:1.5px solid var(--line);border-radius:999px;background:var(--panel);color:var(--blue);font-size:12px;font-weight:700}
.pause-sound-heading button[aria-pressed=true]{color:var(--muted)}
.pause-sound-slider{display:grid;gap:6px;font-size:13px;font-weight:700;color:var(--ink)}
.pause-slider-caption{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:30px}
.pause-slider-side{display:flex;align-items:center;gap:8px}
.pause-slider-caption output{font-variant-numeric:tabular-nums;color:var(--blue);font-weight:800}
.pause-preview{width:30px;height:30px;padding:0;display:grid;place-items:center;border:1.5px solid var(--line);background:var(--panel);border-radius:10px;color:var(--blue);font-size:11px;box-shadow:0 2px 0 var(--shade)}
.pause-preview:active{transform:translateY(2px);box-shadow:none}
/* Native input and thumb both use an 18px vertical box; the 7px track is painted
   in its center, avoiding cross-browser thumb margin offsets. */
.pause-sound-slider input[type=range]{-webkit-appearance:none;appearance:none;display:block;width:100%;height:18px;margin:0;padding:0;cursor:pointer;touch-action:pan-y;outline-offset:4px;--fillpos:calc(9px + (100% - 18px) * var(--p,0));background:linear-gradient(to right,var(--blue) 0,var(--blue) var(--fillpos),var(--track) var(--fillpos),var(--track) 100%) center / 100% 7px no-repeat}
.pause-sound-slider input[type=range]::-webkit-slider-runnable-track{height:18px;background:transparent;border:0;border-radius:0}
.pause-sound-slider input[type=range]::-moz-range-track{height:18px;background:transparent;border:0;border-radius:0}
.pause-sound-slider input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;box-sizing:border-box;width:18px;height:18px;margin-top:0;border-radius:50%;border:2px solid var(--blue);background:var(--panel);box-shadow:0 2px 0 var(--blue-dark)}
.pause-sound-slider input[type=range]::-moz-range-thumb{box-sizing:border-box;width:18px;height:18px;border-radius:50%;border:2px solid var(--blue);background:var(--panel);box-shadow:0 2px 0 var(--blue-dark)}
.pause-select-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.pause-select-row{display:grid;gap:6px;min-width:0;font-size:13px;font-weight:700;color:var(--ink)}
.pause-select-row select{width:100%;min-width:0;min-height:44px;border:1.5px solid var(--line);border-radius:12px;padding:0 8px;color:var(--ink);background:var(--panel);font-size:13px;font-weight:700}
@media(max-width:359px){.pause-select-grid{grid-template-columns:1fr}}
@media(max-height:640px){.sokudoku-pause-character{width:64px;height:64px}.sokudoku-pause-card{padding:14px 16px}.sokudoku-pause-subtitle{margin-bottom:12px}.sokudoku-pause-main{min-height:46px;margin-bottom:8px}.pause-sound-controls{gap:10px;margin-top:12px;padding-top:12px}}
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
    el.onclick = action;
    return el;
  };
  card.append(
    character, title, subtitle,
    button(view.t("つづける →", "계속하기 →"), actions.resume, "sokudoku-pause-main primary"),
    button(view.t("終了して保存", "종료하고 저장"), actions.finish, "sokudoku-pause-main"),
  );
  const quick = document.createElement("div");
  quick.className = "sokudoku-pause-quick";
  quick.append(
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
