"use client";
import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { defaultPreferences, type Preferences } from "@/lib/game/preferences";
import { settingsStore } from "@/lib/settings-store";
const Context = createContext<{
  prefs: Preferences;
  change: (p: Partial<Preferences>) => void;
}>({ prefs: defaultPreferences, change: settingsStore.change });
export function SettingsProvider({ children }: { children: ReactNode }) {
  const prefs = useSyncExternalStore(
    settingsStore.subscribe,
    settingsStore.getSnapshot,
    () => defaultPreferences,
  );
  useEffect(() => {
    document.documentElement.lang = prefs.lang === "jp" ? "ja" : "ko";
    document.documentElement.dataset.theme = prefs.theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", prefs.theme === "dark" ? "#0b1530" : "#f3f8ff");
  }, [prefs]);
  return (
    <Context.Provider value={{ prefs, change: settingsStore.change }}>
      {children}
    </Context.Provider>
  );
}
export const useSettings = () => useContext(Context);
