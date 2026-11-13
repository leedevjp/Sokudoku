export type CompanionMode = "fixed" | "follow";
const key = "sokudoku-companion-mode-v2";
let mode: CompanionMode = "fixed";
let memoryOnly = false;
const listeners = new Set<() => void>();
function getSnapshot(): CompanionMode {
  if (memoryOnly) return mode;
  try { mode = localStorage.getItem(key) === "follow" ? "follow" : "fixed"; } catch {}
  return mode;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const storage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) { memoryOnly = false; listener(); }
  };
  window.addEventListener("storage", storage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", storage); };
}
function toggle() {
  mode = getSnapshot() === "fixed" ? "follow" : "fixed";
  try { localStorage.setItem(key, mode); memoryOnly = false; } catch { memoryOnly = true; }
  for (const listener of listeners) listener();
}
export const companionModeStore = { getSnapshot, getServerSnapshot: (): CompanionMode => "fixed", subscribe, toggle };
