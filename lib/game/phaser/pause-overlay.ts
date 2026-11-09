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
  soundExpanded: boolean;
  setSoundExpanded: (expanded: boolean) => void;
};

export function drawPause(view: TrainingView, actions: PauseActions): Phaser.GameObjects.Container {
  const overlay = view.add.container(0, 0).setDepth(100);
  overlay.add(view.add.rectangle(view.w / 2, view.h / 2, view.w, view.h, view.c.bg, .96).setInteractive());

  const rabbit = view.createRestingRabbit(view.w / 2, view.h / 2 - 220, 100);
  overlay.add(rabbit.root);

  const root = document.createElement("div");
  root.className = "sokudoku-pause-root";
  root.setAttribute("role", "presentation");
  const css = document.createElement("style");
  css.textContent = `
    .sokudoku-pause-root{position:fixed;z-index:1000;box-sizing:border-box;display:grid;place-items:center;pointer-events:auto;padding:12px;font-family:system-ui,-apple-system,sans-serif;color:var(--ink)}
    .sokudoku-pause-root *{box-sizing:border-box}
    .sokudoku-pause-card{width:min(440px,100%);max-height:100%;overflow-y:auto;overscroll-behavior:contain;border:1px solid var(--line);border-radius:26px;padding:24px 20px 20px;background:var(--panel);box-shadow:0 5px 0 var(--shade);text-align:center;scrollbar-width:thin}
    .sokudoku-pause-card h2{font-size:clamp(23px,5vw,30px);margin:0 0 10px;font-weight:800;line-height:1.3;color:var(--ink)}
    .sokudoku-pause-subtitle{font-size:14px;color:var(--muted);margin:0 0 24px}
    .sokudoku-pause-card button,.sokudoku-pause-card select{font:inherit;cursor:pointer;touch-action:manipulation}
    .sokudoku-pause-main{display:block;width:min(260px,100%);min-height:48px;margin:0 auto 12px;border-radius:13px;border:1px solid var(--line);font-weight:750!important;color:var(--ink);background:var(--panel);box-shadow:0 4px 0 var(--shade)}
    .sokudoku-pause-main.primary{background:var(--blue);color:var(--on-blue);border-color:var(--blue-dark);box-shadow:0 4px 0 var(--blue-dark)}
    .sokudoku-pause-quick{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:18px}
    .sokudoku-pause-quick button{min-height:42px;padding:0 14px;background:var(--panel);border:1px solid var(--line);color:var(--ink);border-radius:12px;box-shadow:0 3px 0 var(--shade);font-weight:700}
    .sokudoku-pause-details{margin:18px 0 0;text-align:left;border-top:1px solid var(--line);padding-top:12px}
    .sokudoku-pause-details>summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;min-height:40px;font-weight:750;color:var(--ink);user-select:none}
    .sokudoku-pause-details>summary::-webkit-details-marker{display:none}
    .sokudoku-pause-details>summary:after{content:"⌄";font-size:22px;transition:transform .15s}
    .sokudoku-pause-details[open]>summary:after{transform:rotate(180deg)}
    .pause-sound-controls{display:grid;gap:12px;padding:10px 0 4px}
    .pause-sound-heading,.pause-slider-caption{display:flex;align-items:center;justify-content:space-between;gap:10px}
    .pause-sound-heading{margin-bottom:2px}
    .pause-sound-heading button{border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--ink);min-height:38px;padding:4px 12px;font-size:13px}
    .pause-sound-slider{display:grid;gap:6px;font-size:13px;font-weight:650}
    .pause-slider-caption output{font-variant-numeric:tabular-nums;color:var(--muted)}
    .pause-sound-slider input[type=range]{appearance:none;-webkit-appearance:none;display:block;width:calc(100% - 18px);margin:5px 9px;height:6px;min-height:6px;border-radius:999px;background:linear-gradient(to right,var(--blue) 0%,var(--blue) var(--fill),var(--track) var(--fill),var(--track) 100%);outline-offset:9px;cursor:pointer;touch-action:none}
    .pause-sound-slider input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:18px;height:18px;border-radius:50%;border:0;background:var(--blue);box-shadow:0 0 0 2px var(--panel)}
    .pause-sound-slider input[type=range]::-moz-range-thumb{width:18px;height:18px;border-radius:50%;border:0;background:var(--blue)}
    .pause-preview{justify-self:end;min-height:34px;padding:4px 10px;border:1px solid var(--line);background:var(--panel);border-radius:10px;color:var(--ink);font-size:12px!important}
    .pause-select-row{display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:13px;font-weight:650}
    .pause-select-row select{min-width:0;width:55%;min-height:40px;border:1px solid var(--line);border-radius:10px;padding:6px;color:var(--ink);background:var(--panel);font-size:13px}
    @media(max-height:590px){.sokudoku-pause-card{padding:14px 16px}.sokudoku-pause-subtitle{margin-bottom:12px}.sokudoku-pause-quick{margin-top:10px}.sokudoku-pause-details{margin-top:10px}}
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
    title, subtitle,
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
    const details = document.createElement("details");
    details.className = "sokudoku-pause-details";
    details.open = actions.soundExpanded;
    const summary = document.createElement("summary");
    summary.textContent = view.t("音設定", "소리 설정");
    details.append(summary, createSoundControls(
      actions.audio,
      (jp, kr) => view.t(jp, kr),
      actions.preferences,
      actions.changePreferences,
      actions.toggleSound,
    ));
    details.addEventListener("toggle", () => {
      actions.setSoundExpanded(details.open);
      rabbit.root.setVisible(!details.open);
    });
    rabbit.root.setVisible(!details.open);
    card.append(details);
  }
  root.append(css, card);
  const align = () => {
    const rect = view.add.game.canvas.getBoundingClientRect();
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
    root.remove();
  };
  overlay.once("destroy", cleanup);
  return overlay;
}
