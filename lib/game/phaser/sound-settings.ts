import type { BattleAudio } from "./battle-audio";
import type { Preferences } from "../preferences";

/** Inline audio controls shared with the pause panel. Never opens another modal. */
export function createSoundControls(
  audio: BattleAudio,
  t: (jp: string, kr: string) => string,
  preferences: Preferences,
  changePreferences: (preferences: Preferences) => void,
  toggleSound: () => void,
): HTMLElement {
  const section = document.createElement("section");
  section.className = "pause-sound-controls";
  const muteRow = document.createElement("div");
  muteRow.className = "pause-sound-heading";
  const heading = document.createElement("strong");
  heading.textContent = t("音設定", "소리 설정");
  const mute = document.createElement("button");
  mute.type = "button";
  mute.className = "pause-mute";
  const refreshMute = () => {
    mute.textContent = audio.enabled ? t("♪ 音声オン", "♪ 소리 켜짐") : t("♪̸ 消音中", "♪̸ 음소거 중");
    mute.setAttribute("aria-pressed", String(!audio.enabled));
  };
  mute.onclick = () => { toggleSound(); refreshMute(); };
  refreshMute();
  muteRow.append(heading, mute);
  section.append(muteRow);

  /** Slider row with an optional preview button beside the value. */
  const slider = (name: string, initial: number, change: (value: number) => void, extra?: HTMLElement) => {
    const group = document.createElement("div");
    group.className = "pause-sound-slider";
    const row = document.createElement("span");
    row.className = "pause-slider-caption";
    const nameSpan = document.createElement("span");
    nameSpan.textContent = name;
    const side = document.createElement("span");
    side.className = "pause-slider-side";
    const value = document.createElement("output");
    const input = document.createElement("input");
    input.type = "range";
    input.min = "0";
    input.max = "100";
    input.step = "1";
    input.value = String(Math.round(initial * 100));
    input.setAttribute("aria-label", name);
    const refresh = () => {
      value.textContent = input.value + "%";
      input.style.setProperty("--p", String(Number(input.value) / 100));
    };
    input.addEventListener("input", () => {
      change(Number(input.value) / 100);
      refresh();
    });
    refresh();
    side.append(value);
    if (extra) side.append(extra);
    row.append(nameSpan, side);
    group.append(row, input);
    section.append(group);
  };
  const preview = document.createElement("button");
  preview.type = "button";
  preview.className = "pause-preview";
  preview.textContent = "▶";
  preview.title = t("効果音を試す", "효과음 미리듣기");
  preview.setAttribute("aria-label", preview.title);
  preview.onclick = () => audio.play("dash");
  slider(t("BGM", "배경음"), audio.musicVolume, value => audio.setVolumes(value, audio.effectsVolume));
  slider(t("効果音", "효과음"), audio.effectsVolume, value => audio.setVolumes(audio.musicVolume, value), preview);

  let current = preferences;
  const change = (patch: Partial<Preferences>) => {
    current = { ...current, ...patch };
    changePreferences(current);
  };
  const selects = document.createElement("div");
  selects.className = "pause-select-grid";
  section.append(selects);
  const selectSetting = (
    title: string,
    options: { value: string; text: string }[],
    selected: string,
    onChange: (value: string) => void,
  ) => {
    const row = document.createElement("label");
    row.className = "pause-select-row";
    const caption = document.createElement("span");
    caption.textContent = title;
    const select = document.createElement("select");
    select.setAttribute("aria-label", title);
    for (const option of options) {
      const node = document.createElement("option");
      node.value = option.value;
      node.textContent = option.text;
      select.append(node);
    }
    select.value = selected;
    select.onchange = () => onChange(select.value);
    row.append(caption, select);
    selects.append(row);
  };
  selectSetting(t("単語の発音", "단어 발음"), [
    { value: "off", text: t("オフ", "끄기") },
    { value: "always", text: t("正解・不正解", "정답·오답 모두") },
    { value: "wrong", text: t("不正解のみ", "오답일 때만") },
  ], current.pronunciation, value => change({ pronunciation: value as Preferences["pronunciation"] }));
  selectSetting(t("読み上げる文字", "읽을 텍스트"), [
    { value: "term", text: t("単語の表記", "단어 원문") },
    { value: "kana", text: t("かな（読み）", "가나(읽기)") },
  ], current.pronunciationSource, value => change({ pronunciationSource: value as Preferences["pronunciationSource"] }));
  return section;
}
