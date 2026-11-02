"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { defaultPreferences, type Preferences } from "@/lib/game/preferences";
const Context = createContext<{
  prefs: Preferences;
  change: (p: Partial<Preferences>) => void;
}>({ prefs: defaultPreferences, change: () => {} });
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState(defaultPreferences);
  useEffect(() => {
    try {
      const p = JSON.parse(
        localStorage.getItem("sokudoku-preferences") ?? "null",
      );
      if (p)
        setPrefs({
          lang: p.lang === "kr" ? "kr" : "jp",
          theme: p.theme === "dark" ? "dark" : "light",
        });
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = prefs.lang === "jp" ? "ja" : "ko";
    document.documentElement.dataset.theme = prefs.theme;
  }, [prefs]);
  function change(p: Partial<Preferences>) {
    setPrefs((old) => {
      const next = { ...old, ...p };
      try {
        localStorage.setItem("sokudoku-preferences", JSON.stringify(next));
      } catch {}
      return next;
    });
  }
  return (
    <Context.Provider value={{ prefs, change }}>{children}</Context.Provider>
  );
}
export const useSettings = () => useContext(Context);
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
