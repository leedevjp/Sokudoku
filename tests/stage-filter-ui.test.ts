import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (name: string) => readFileSync(path.join(process.cwd(), name), "utf8");

test("stage picker removes redundant visible heading but keeps dialog accessible", () => {
  const component = read("components/ui/stage-filter.tsx");
  assert.match(component, /<h2 id=\{title\} className=\{styles\.srOnly\}>/);
  assert.match(component, /<Modal open titleId=\{title\}/);
  assert.match(component, /aria-pressed=\{selected\}/);
  assert.match(component, /onChange\(option\.value\)/);
  assert.match(component, /setOpen\(false\)/);
  assert.match(component, /aria-label=\{t\("ステージ", "단계 필터"\)\}/);
});

test("stage filter displays difficulty beside stage, not underneath it", () => {
  const component = read("components/ui/stage-filter.tsx");
  const css = read("components/ui/stage-filter.module.css");
  assert.match(component, /className=\{styles\.optionLabel\}/);
  assert.match(component, /className=\{styles\.optionTrailing\}/);
  assert.match(component, /className=\{styles\.optionDetail\}/);
  assert.match(css, /\.option\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto/);
  assert.match(css, /\.optionTrailing\s*\{[^}]*display:\s*inline-flex/);
  assert.match(css, /\.optionDetail\s*\{[^}]*white-space:\s*nowrap/);
  assert.match(css, /\.optionCheck\s*\{[^}]*width:\s*20px/);
  assert.match(css, /@media \(max-width:\s*360px\)/);
});

test("personal word stages and notebook stages still share the same filter", () => {
  const personal = read("components/personal/personal-screen.tsx");
  const notebook = read("components/notebook/notebook-controls.tsx");
  assert.match(personal, /<StageFilter personal value=\{words\.stage\}/);
  assert.match(notebook, /<StageFilter value=\{query\.stage\}/);
});
