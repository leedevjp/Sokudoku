import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const globalCss = readFileSync(path.join(root, "app/globals.css"), "utf8");
const imports = Array.from(
  globalCss.matchAll(/@import\s+["']([^"']+)["'];/g),
  (match) => match[1],
);

const orderedHomeModules = [
  "../styles/home/base.css",
  "../styles/home/responsive.css",
  "../styles/home/controls.css",
  "../styles/home/preview-layout.css",
  "../styles/home/header-actions.css",
  "../styles/home/viewport-layout.css",
  "../styles/home/deployment-layout.css",
  "../styles/home/folder.css",
  "../styles/home/folder-controls.css",
  "../styles/home/folder-adaptive.css",
  "../styles/home/desktop-layout.css",
  "../styles/home/sheen.css",
];

test("every global stylesheet import resolves to a file", () => {
  for (const stylesheet of imports) {
    const resolved = path.resolve(root, "app", stylesheet);
    assert.ok(existsSync(resolved), `Missing stylesheet: ${stylesheet}`);
  }
});

test("home styles remain in their defined cascade order", () => {
  const ordered = orderedHomeModules.map((stylesheet) => imports.indexOf(stylesheet));
  assert.ok(ordered.every((index) => index >= 0), "Every home module must be imported");
  assert.deepEqual([...ordered].sort((a, b) => a - b), ordered, "Home style import order changed");
  assert.equal(new Set(imports).size, imports.length, "Duplicate stylesheet import");
  for (const retired of [
    "../styles/home.css",
    "../styles/home-responsive.css",
    "../styles/home-controls.css",
    "../styles/home-compact.css",
  ]) {
    assert.ok(!imports.includes(retired), `Retired stylesheet still imported: ${retired}`);
  }
});

test("folder perimeter has one SVG source of truth", () => {
  const folder = readFileSync(path.join(root, "styles/home/folder.css"), "utf8");
  const sheet = readFileSync(path.join(root, "styles/home/folder-controls.css"), "utf8");
  const sheen = readFileSync(path.join(root, "styles/home/sheen.css"), "utf8");
  assert.match(folder, /\.home-folder-outline path/);
  assert.doesNotMatch(folder, /training-modes[^{}]*::(?:before|after)/);
  assert.match(sheet, /\.home-folder-body/);
  assert.match(sheen, /@keyframes home-unified-sheen/);
});
