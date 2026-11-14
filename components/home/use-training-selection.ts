"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { trainingKinds, parseKinds, trainingLevels, parseLevels, type TrainingLevel } from "@/lib/game/selection";
import type { Kind } from "@/lib/game/types";
import { parseModes, defaultTrainingModes, toggleTrainingMode, type TrainingMode } from "@/lib/game/learning/types";
import { homeTrainingPreloader } from "@/lib/game/data/home-preloader";

type ModeFamily = "auto" | "manual" | "exam";
type ModeScope = { levels: TrainingLevel[]; kinds: Kind[] };
type ModeScopes = Record<ModeFamily, ModeScope>;
const MODE_SCOPES_KEY = "sokudoku-mode-scopes-v1";
const freshScope = (): ModeScope => ({ levels: [...trainingLevels], kinds: [...trainingKinds] });
const freshScopes = (): ModeScopes => ({
  auto: freshScope(),
  manual: freshScope(),
  exam: freshScope(),
});
const modeFamily = (modes: TrainingMode[]): ModeFamily =>
  modes.includes("auto") ? "auto" : modes.includes("exam") ? "exam" : "manual";

function restoreScope(value: unknown): ModeScope {
  if (!value || typeof value !== "object") return freshScope();
  const data = value as Partial<ModeScope>;
  return {
    levels: Array.isArray(data.levels)
      ? parseLevels(data.levels.filter((level): level is TrainingLevel => typeof level === "string").join(","))
      : [...trainingLevels],
    kinds: Array.isArray(data.kinds)
      ? parseKinds(data.kinds.filter((kind): kind is Kind => typeof kind === "string").join(","))
      : [...trainingKinds],
  };
}

/**
 * Home UI selection state. Persists independent mode scopes and preloads the
 * first quiz using the last cached choices; it does not render UI.
 */
export function useTrainingSelection(owner: string | undefined, loading: boolean) {
  const [levels, setLevels] = useState<TrainingLevel[]>([...trainingLevels]);
  const [kinds, setKinds] = useState<Kind[]>(trainingKinds);
  const [modes, setModes] = useState<TrainingMode[]>(defaultTrainingModes);
  const [timeLimited, setTimeLimited] = useState(false);
  const [selectionReady, setSelectionReady] = useState(false);
  const modeScopesRef = useRef<ModeScopes>(freshScopes());
  const activeFolder = modeFamily(modes);
  const kanaOnly =
    levels.length > 0 &&
    levels.every((level) => level === "H" || level === "K");
  const canStart =
    levels.length > 0 &&
    kinds.length > 0 &&
    modes.length > 0 &&
    (!kanaOnly || kinds.includes("meaning"));
  // One mount-only hydration from browser storage; layout updates are batched
  // before the hidden controls are revealed. This is intentional restoration.
  /* eslint-disable react-hooks/set-state-in-effect */
  useLayoutEffect(() => {
    // The server cannot read localStorage. Restore before revealing the mode
    // controls, so the saved folder never flashes the fallback blue style.
    try {
      const savedTimeLimit = localStorage.getItem("sokudoku-time-limit-v1");
      if (savedTimeLimit !== null) setTimeLimited(savedTimeLimit !== "off");
      const savedModes = localStorage.getItem("sokudoku-modes-v1");
      const restoredModes = parseModes(savedModes);
      const activeFamily = modeFamily(restoredModes);
      const rawScopes = localStorage.getItem(MODE_SCOPES_KEY);
      const scopes = freshScopes();
      if (rawScopes !== null) {
        const raw = JSON.parse(rawScopes) as Partial<Record<ModeFamily, unknown>>;
        for (const family of ["auto", "manual", "exam"] as const) {
          scopes[family] = restoreScope(raw?.[family]);
        }
      } else {
        // One-time migration: honor the previous shared selection in the
        // last active mode. Other modes start with everything selected.
        const savedLevels = localStorage.getItem("sokudoku-levels-v1");
        const savedKinds = localStorage.getItem("sokudoku-kinds-v1");
        if (savedLevels !== null || savedKinds !== null) {
          scopes[activeFamily] = {
            levels: savedLevels === null ? [...trainingLevels] : parseLevels(savedLevels),
            kinds: savedKinds === null ? [...trainingKinds] : parseKinds(savedKinds),
          };
        }
        localStorage.setItem(MODE_SCOPES_KEY, JSON.stringify(scopes));
      }
      modeScopesRef.current = scopes;
      setModes(restoredModes);
      setLevels([...scopes[activeFamily].levels]);
      setKinds([...scopes[activeFamily].kinds]);
    } catch {
      /* Optional preference. */
    } finally {
      setSelectionReady(true);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  const levelsKey = levels.join(",");
  const kindsKey = kinds.join(",");
  const modesKey = modes.join(",");
  useEffect(() => {
    if (!selectionReady || loading) return;
    if (!owner || !canStart) {
      homeTrainingPreloader.clear();
      return;
    }
    // Reuse the last saved selections immediately on home load. Changing any
    // filter invalidates the old preloaded quiz and prepares the new one.
    homeTrainingPreloader.warm({
      owner,
      levels: levelsKey,
      kinds: parseKinds(kindsKey),
      modes: parseModes(modesKey),
    });
  }, [selectionReady, loading, owner, canStart, levelsKey, kindsKey, modesKey]);


  function persistScopes() {
    try {
      localStorage.setItem(MODE_SCOPES_KEY, JSON.stringify(modeScopesRef.current));
    } catch { /* Optional preference. */ }
  }
  function toggleLevel(level: TrainingLevel) {
    const next = trainingLevels.filter((item) =>
      item === level ? !levels.includes(item) : levels.includes(item),
    );
    setLevels(next);
    modeScopesRef.current[activeFolder] = { levels: next, kinds: [...kinds] };
    persistScopes();
  }
  function toggleKind(kind: Kind) {
    const next = trainingKinds.filter((item) =>
      item === kind ? !kinds.includes(item) : kinds.includes(item),
    );
    setKinds(next);
    modeScopesRef.current[activeFolder] = { levels: [...levels], kinds: next };
    persistScopes();
  }
  function toggleMode(mode: TrainingMode) {
    const next = toggleTrainingMode(modes, mode);
    const nextFolder = modeFamily(next);
    // Save the current selections before switching folders. Each folder gets
    // full defaults only on its first visit, then remembers every adjustment.
    modeScopesRef.current[activeFolder] = { levels: [...levels], kinds: [...kinds] };
    if (nextFolder !== activeFolder) {
      const restored = modeScopesRef.current[nextFolder];
      setLevels([...restored.levels]);
      setKinds([...restored.kinds]);
    }
    setModes(next);
    persistScopes();
    try {
      localStorage.setItem("sokudoku-modes-v1", next.join(","));
    } catch {
      /* Optional preference. */
    }
  }
  function changeTimeLimit(value: boolean) {
    setTimeLimited(value);
    try {
      localStorage.setItem("sokudoku-time-limit-v1", value ? "on" : "off");
    } catch { /* Optional preference. */ }
  }
  return {
    levels, kinds, modes, timeLimited, selectionReady, activeFolder, kanaOnly,
    canStart, toggleLevel, toggleKind, toggleMode, changeTimeLimit,
  };
}
