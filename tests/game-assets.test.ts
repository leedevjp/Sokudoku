import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildGameAssets } from "../lib/game/build-assets";

test("game assets keep content URLs across builds and change only when bytes change", () => {
  const root = mkdtempSync(join(tmpdir(), "sokudoku-assets-"));
  mkdirSync(join(root, "audio"));
  writeFileSync(join(root, "audio", "test.mp3"), "original audio");
  const first = buildGameAssets(root, ["/audio/test.mp3"]);
  assert.match(first["/audio/test.mp3"], /^\/game-assets\/[a-f0-9]{64}\.mp3$/);
  assert.deepEqual(buildGameAssets(root, ["/audio/test.mp3"]), first);
  writeFileSync(join(root, "audio", "test.mp3"), "updated audio");
  const second = buildGameAssets(root, ["/audio/test.mp3"]);
  assert.notEqual(second["/audio/test.mp3"], first["/audio/test.mp3"]);
  assert.equal(readFileSync(join(root, first["/audio/test.mp3"].slice(1)), "utf8"), "original audio");
  assert.equal(readFileSync(join(root, second["/audio/test.mp3"].slice(1)), "utf8"), "updated audio");
});
