import assert from "node:assert/strict";
import test from "node:test";
import { makeFolderOutline, type FolderOutlineGeometry } from "../components/home/folder-outline-path";

const GAP = 8;
const scenarios = ["auto", "exploration", "review", "exploration+review", "exam", "none"] as const;
type Scenario = (typeof scenarios)[number];

/** Simulate the real 4-column equal-width picker; buttons are inset 4px. */
function measuredFolder(width: number, scenario: Scenario): FolderOutlineGeometry {
  const col = (width - 3 * GAP) / 4;
  const selected: Record<Exclude<Scenario, "none">, [number, number]> = {
    auto: [0, 0],
    exploration: [1, 1],
    review: [2, 2],
    "exploration+review": [1, 2],
    exam: [3, 3],
  };
  const tab = scenario === "none" ? undefined : (() => {
    const [from, to] = selected[scenario];
    return {
      left: from * (col + GAP),
      right: to * (col + GAP) + col,
      top: 34,
    };
  })();
  return { width, height: 520, bodyTop: 84, tab };
}

for (const width of [280, 320, 360, 375, 390, 430, 600, 768, 1280]) {
  for (const mode of scenarios) {
    test(`one continuous outer shape, mode=${mode}, width=${width}`, () => {
      const geometry = measuredFolder(width, mode);
      const path = makeFolderOutline(geometry);
      assert.ok(path.startsWith("M "), "path must start at the raised tab");
      assert.ok(path.endsWith(" Z"), "the folder outline must close");
      assert.equal((path.match(/M /g) ?? []).length, 1, "no disconnected outlines");
      assert.equal((path.match(/ Z/g) ?? []).length, 1, "one closed perimeter only");
      assert.doesNotMatch(path, /NaN|undefined|Infinity/);
      assert.match(path, /Q/, "round both tab and body corners");

      // One continuous outline, no separate SVG strokes for its tabs.
      const commands = path.match(/[MHQVZ]/g) ?? [];
      assert.equal(commands[0], "M");
      assert.equal(commands[commands.length - 1], "Z");
      if (mode !== "none") {
        assert.match(path, /V/, "the active tab must have side walls");
      }
    });
  }
}

test("selected tabs at the outer edges reuse the body's side wall", () => {
  const auto = makeFolderOutline(measuredFolder(390, "auto"));
  const exam = makeFolderOutline(measuredFolder(390, "exam"));
  const middle = makeFolderOutline(measuredFolder(390, "exploration"));
  // Middle tab has the body top-left AND top-right corners, whereas the
  // outermost tabs only have the opposite body corner.
  assert.ok((middle.match(/Q /g) ?? []).length > (auto.match(/Q /g) ?? []).length);
  assert.ok((middle.match(/Q /g) ?? []).length > (exam.match(/Q /g) ?? []).length);
});

test("both manual modes use a single spanning tab, wider than either one", () => {
  const single = measuredFolder(390, "exploration").tab!;
  const joined = measuredFolder(390, "exploration+review").tab!;
  assert.equal(joined.left, single.left);
  assert.ok(joined.right > single.right + 50);
  assert.equal((makeFolderOutline(measuredFolder(390, "exploration+review")).match(/M /g) ?? []).length, 1);
});

test("no selected mode falls back to a normal closed card", () => {
  const path = makeFolderOutline(measuredFolder(390, "none"));
  assert.equal((path.match(/Q /g) ?? []).length, 4);
});

test("gracefully handles zero, malformed and ultra-narrow geometry", () => {
  assert.equal(makeFolderOutline({ width: 0, height: 300, bodyTop: 40 }), "");
  assert.equal(makeFolderOutline({ width: NaN, height: 300, bodyTop: 40 }), "");
  for (const geometry of [
    { width: 33, height: 42, bodyTop: 20, tab: { left: 1, right: 20, top: 2 } },
    { width: 210, height: 180, bodyTop: 50, tab: { left: 40, right: 42, top: 20 } },
    { width: 320, height: 400, bodyTop: 100, tab: { left: 80, right: 260, top: 99 } },
  ]) {
    const path = makeFolderOutline(geometry);
    assert.ok(path.endsWith(" Z"));
    assert.doesNotMatch(path, /NaN|undefined|Infinity/);
  }
});

test("the same mode remains seamless after vertical resizing", () => {
  for (const mode of scenarios) {
    const geometry = measuredFolder(390, mode);
    const short = makeFolderOutline({ ...geometry, height: 340, bodyTop: 75 });
    const tall = makeFolderOutline({ ...geometry, height: 760, bodyTop: 110 });
    assert.notEqual(short, tall);
    assert.equal((short.match(/M /g) ?? []).length, 1);
    assert.equal((tall.match(/M /g) ?? []).length, 1);
    assert.ok(short.endsWith(" Z") && tall.endsWith(" Z"));
  }
});

test("changing between manual single and dual selections changes one perimeter", () => {
  const exploration = makeFolderOutline(measuredFolder(390, "exploration"));
  const review = makeFolderOutline(measuredFolder(390, "review"));
  const joined = makeFolderOutline(measuredFolder(390, "exploration+review"));
  assert.notEqual(exploration, review);
  assert.notEqual(exploration, joined);
  assert.notEqual(review, joined);
  for (const path of [exploration, review, joined]) {
    assert.equal((path.match(/M /g) ?? []).length, 1);
  }
});
