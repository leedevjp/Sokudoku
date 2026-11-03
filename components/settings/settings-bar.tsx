"use client";
import { useSettings } from "./settings-provider";
export function SettingsBar() {
  const { prefs, change } = useSettings();
  return (
    <div
      className="settings-bar"
      aria-label={prefs.lang === "jp" ? "表示設定" : "표시 설정"}
    >
      <button
        onClick={() => change({ lang: prefs.lang === "jp" ? "kr" : "jp" })}
        aria-label="KR / JP"
        title={prefs.lang === "jp" ? "韓国語に切り替える" : "일본어로 바꾸기"}
      >
        {prefs.lang === "jp" ? "JP" : "KR"} <span>⇄</span>
      </button>
      <button
        onClick={() =>
          change({ theme: prefs.theme === "light" ? "dark" : "light" })
        }
      >
        {prefs.theme === "light" ? "☾" : "☀"}{" "}
        {prefs.lang === "jp"
          ? prefs.theme === "light"
            ? "ダーク"
            : "ライト"
          : prefs.theme === "light"
            ? "다크"
            : "라이트"}
      </button>
    </div>
  );
}
