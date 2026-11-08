import type { BattleAudio } from "./battle-audio";
import type { Preferences } from "../preferences";

/** Native dialog keeps sliders keyboard accessible above the paused canvas. */
export function openSoundSettings(audio: BattleAudio, t: (jp: string, kr: string) => string, onClose: () => void, preferences: Preferences, changePreferences: (p: Preferences) => void) {
  const previousFocus = document.activeElement;
  const dialog = document.createElement("dialog");
  dialog.setAttribute("aria-label", t("音の設定", "소리 설정"));
  dialog.style.cssText = "width:min(360px,calc(100vw - 32px));box-sizing:border-box;padding:24px;border:1px solid #c6d6ee;border-radius:24px;background:#f8fbff;color:#20354f;box-shadow:0 20px 80px #162c4e55;font:16px system-ui;";
  const style = document.createElement("style");
  style.textContent = "dialog.study-sound::backdrop{background:#15294588}dialog.study-sound button{min-height:44px;border:1px solid #b9cce6;border-radius:12px;background:white;color:#20354f;padding:8px 14px;font:inherit;cursor:pointer}dialog.study-sound input{width:100%;accent-color:#2879ed;min-height:44px;cursor:pointer}";
  dialog.className = "study-sound";
  const header = document.createElement("div");
  header.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px";
  const title = document.createElement("h2");
  title.textContent = t("音の設定", "소리 설정");
  title.style.cssText = "margin:0;font-size:22px";
  const close = document.createElement("button");
  close.textContent = "×";
  close.setAttribute("aria-label", t("閉じる", "닫기"));
  close.onclick = () => dialog.close();
  header.append(title, close);
  const mute = document.createElement("button");
  mute.style.cssText = "width:100%;margin-bottom:20px";
  const refreshMute = () => { mute.textContent = audio.enabled ? t("消音する", "음소거") : t("音をオンにする", "소리 켜기"); mute.setAttribute("aria-pressed", String(!audio.enabled)); };
  refreshMute();
  mute.onclick = () => { audio.toggle(); refreshMute(); };
  dialog.append(style, header, mute);
  const slider = (name: string, value: number, change: (value: number) => void) => {
    const label = document.createElement("label");
    label.style.cssText = "display:block;margin:16px 0";
    const caption = document.createElement("span");
    const input = document.createElement("input");
    input.type = "range";
    input.min = "0"; input.max = "100"; input.step = "1";
    input.value = String(Math.round(value * 100));
    input.setAttribute("aria-label", name);
    const refresh = () => { caption.textContent = `${name} · ${input.value}%`; };
    refresh();
    input.oninput = () => { change(Number(input.value) / 100); refresh(); };
    label.append(caption, input);
    dialog.append(label);
  };
  slider(t("BGM", "배경음"), audio.musicVolume, value => audio.setVolumes(value, audio.effectsVolume));
  slider(t("効果音", "효과음"), audio.effectsVolume, value => audio.setVolumes(audio.musicVolume, value));
  const preview = document.createElement("button");
  preview.textContent = t("効果音を試す", "효과음 미리듣기");
  preview.onclick = () => audio.play("dash");
  dialog.append(preview);
  const selectSetting = (labelText: string, options: { value: string; text: string }[], value: string, update: (value: string) => void) => {
    const label = document.createElement("label");
    label.style.cssText = "display:block;margin:16px 0";
    const caption = document.createElement("span");
    caption.textContent = labelText;
    const select = document.createElement("select");
    select.style.cssText = "display:block;width:100%;margin-top:8px;min-height:44px;padding:8px;border-radius:12px;border:1px solid #b9cce6;background:white;color:#20354f;font:inherit";
    for (const option of options) { const node = document.createElement("option"); node.value = option.value; node.textContent = option.text; select.append(node); }
    select.value = value;
    select.onchange = () => update(select.value);
    label.append(caption, select);
    dialog.append(label);
  };
  let current = preferences;
  const change = (patch: Partial<Preferences>) => { current = { ...current, ...patch }; changePreferences(current); };
  selectSetting(t("単語の発音", "단어 발음"), [
    { value: "off", text: t("オフ", "끄기") },
    { value: "always", text: t("正解・不正解の両方", "정답·오답 모두") },
    { value: "wrong", text: t("不正解のみ", "오답일 때만") },
  ], current.pronunciation, value => change({ pronunciation: value as Preferences["pronunciation"] }));
  selectSetting(t("読み上げる文字", "발음에 사용할 텍스트"), [
    { value: "term", text: t("単語（漢字表記）", "단어 원문(term)") },
    { value: "kana", text: t("かな（読み）", "가나(kana)") },
  ], current.pronunciationSource, value => change({ pronunciationSource: value as Preferences["pronunciationSource"] }));
  // Capture key input so Escape closes only this dialog and number keys never answer.
  const keydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") { event.preventDefault(); dialog.close(); }
    event.stopImmediatePropagation();
  };
  window.addEventListener("keydown", keydown, true);
  dialog.addEventListener("click", event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    audio.preview = false;
    audio.stop();
    window.removeEventListener("keydown", keydown, true);
    dialog.remove();
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    onClose();
  };
  dialog.addEventListener("close", cleanup, { once: true });
  document.body.append(dialog);
  audio.preview = true;
  dialog.showModal();
  return () => { dialog.close(); cleanup(); };
}
