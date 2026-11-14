import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (name: string) => readFileSync(path.join(process.cwd(), name), "utf8");

test("personal word stages and notebook stages still share the same filter", () => {
  const personal = read("components/personal/personal-screen.tsx");
  const notebook = read("components/notebook/notebook-controls.tsx");
  assert.match(personal, /<StageFilter personal value=\{words\.stage\}/);
  assert.match(notebook, /<StageFilter value=\{query\.stage\}/);
});
