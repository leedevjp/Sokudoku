import { defaultPreferences, type Preferences } from "./game/preferences";
const KEY = "sokudoku-preferences";
let snapshot = defaultPreferences;
let rawSnapshot: string | null | undefined;
let memoryOnly = false;
const listeners = new Set<() => void>();

/** Stable snapshots keep SSR/hydration consistent and tolerate blocked storage. */
function getSnapshot(): Preferences {
  if (memoryOnly) return snapshot;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== rawSnapshot) {
      rawSnapshot = raw;
      const parsed = JSON.parse(raw ?? "null");
      snapshot = parsed
        ? {
            lang: parsed.lang === "kr" ? "kr" : "jp",
            theme: parsed.theme === "dark" ? "dark" : "light",
            pronunciation: parsed.pronunciation === "always" || parsed.pronunciation === "wrong" || parsed.pronunciation === "off" ? parsed.pronunciation : "always",
            pronunciationSource: parsed.pronunciationSource === "kana" ? "kana" : "term",
          }
        : defaultPreferences;
    }
  } catch {
    /* Keep session preferences when storage is unavailable. */
  }
  return snapshot;
}
function change(patch: Partial<Preferences>) {
  snapshot = { ...getSnapshot(), ...patch };
  const raw = JSON.stringify(snapshot);
  try {
    localStorage.setItem(KEY, raw);
    rawSnapshot = raw;
  } catch {
    memoryOnly = true;
  }
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const storage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) {
      rawSnapshot = undefined;
      memoryOnly = false;
      listener();
    }
  };
  window.addEventListener("storage", storage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", storage);
  };
}
export const settingsStore = { getSnapshot, change, subscribe };
