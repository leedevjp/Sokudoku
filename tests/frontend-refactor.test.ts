import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

test("home keeps persistence and preloading out of its UI component", () => {
  const screen = read("components/home/home-screen.tsx");
  const selection = read("components/home/use-training-selection.ts");
  const sheen = read("components/home/use-home-sheen.ts");
  assert.match(screen, /useTrainingSelection\(user\?\.id, loading\)/);
  assert.match(screen, /useHomeSheen\(/);
  assert.doesNotMatch(screen, /localStorage|homeTrainingPreloader|new ResizeObserver/);
  for (const key of ["sokudoku-modes-v1", "sokudoku-mode-scopes-v1", "sokudoku-time-limit-v1"])
    assert.ok(selection.includes(key), `saved preference key ${key} must survive refactoring`);
  assert.match(selection, /useLayoutEffect\(/, "cached selection is restored before visible paint");
  assert.match(selection, /homeTrainingPreloader\.warm\(/, "first game quiz remains prepared on home");
  assert.match(sheen, /ResizeObserver/);
  assert.match(sheen, /joinedTabs\.length === 2/);
});

test("pause overlay is a DOM controller with a reusable stylesheet", () => {
  const screen = read("lib/game/phaser/pause-overlay.ts");
  const css = read("styles/game-pause.css");
  const globals = read("app/globals.css");
  assert.match(globals, /@import "\.\.\/styles\/game-pause\.css"/);
  assert.doesNotMatch(screen, /css\.textContent|document\.createElement\("style"\)/);
  assert.match(screen, /root\.append\(card\)/);
  assert.match(css, /\.sokudoku-pause-root\s*\{/);
  assert.match(css, /\.sokudoku-pause-quick button\.pause-exit\s*\{/);
  const theme = screen.indexOf('view.t("☾ ダーク"');
  const lang = screen.indexOf('"JP ⇄ KR"');
  const exit = screen.indexOf('view.t("終了・保存"');
  assert.ok(theme >= 0 && theme < lang && lang < exit, "right-hand exit save layout must be retained");
});

test("notebook screen delegates network mutations and selection to its hook", () => {
  const screen = read("components/notebook/notebook-screen.tsx");
  const state = read("components/notebook/use-notebook-state.ts");
  assert.match(screen, /useNotebookState\(t\)/);
  assert.doesNotMatch(screen, /fetch\(|useEffect\(/);
  assert.match(state, /\/api\/notebook\/personal/);
  assert.match(state, /\/api\/personal\/\$\{entry\.id\}/);
  assert.match(state, /setChecked\(\[\]\)/);
  assert.match(state, /controller\.abort\(\)/);
});
