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
      // Ignore malformed/legacy storage without locking the in-memory snapshot.
      let parsed: unknown;
      try { parsed = JSON.parse(raw ?? "null"); } catch { parsed = null; }
      const saved = parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Partial<Preferences>
        : null;
      snapshot = saved
        ? {
            lang: saved.lang === "kr" ? "kr" : "jp",
            theme: saved.theme === "dark" ? "dark" : "light",
            pronunciation: saved.pronunciation === "always" || saved.pronunciation === "wrong" || saved.pronunciation === "off" ? saved.pronunciation : "always",
            pronunciationSource: saved.pronunciationSource === "kana" ? "kana" : "term",
            showReadingHints: saved.showReadingHints === true,
            correctAnswerReview: saved.correctAnswerReview === "card" ? "card" : "instant",
          }
        : defaultPreferences;
      rawSnapshot = raw;
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
    memoryOnly = false;
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
