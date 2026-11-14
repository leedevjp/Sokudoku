import test from "node:test";
import assert from "node:assert/strict";
import { HomeTrainingPreloader, homeTrainingKey, type HomeTrainingSelection } from "../lib/game/data/home-preloader";
import { TrainingRuntime } from "../lib/game/data/training-runtime";
import type { TrainingPlanner } from "../lib/game/learning/planner";

const selection: HomeTrainingSelection = {
  owner: "user-a", levels: "H,K,1,2,3", kinds: ["reading", "meaning"], modes: ["auto"],
};

test("home preloader prepares exactly once and hands the prepared runtime to the game", async t => {
  const loaded: TrainingRuntime[] = [], disposed: TrainingRuntime[] = [];
  t.mock.method(TrainingRuntime.prototype, "load", async function (this: TrainingRuntime) {
    loaded.push(this);
    return { words: [], stats: [], planner: null as unknown as TrainingPlanner };
  });
  t.mock.method(TrainingRuntime.prototype, "dispose", function (this: TrainingRuntime) {
    disposed.push(this);
  });
  const cache = new HomeTrainingPreloader();
  cache.warm(selection);
  cache.warm({ ...selection, kinds: [...selection.kinds] });
  assert.equal(loaded.length, 1);
  const entry = cache.take({ ...selection });
  assert.ok(entry);
  assert.equal(entry.runtime, loaded[0]);
  assert.equal((await entry.data).words.length, 0);
  assert.equal(cache.take(selection), null);
  cache.clear();
  assert.equal(disposed.length, 0, "game owns consumed runtime");
  entry.runtime.dispose();
  assert.deepEqual(disposed, [entry.runtime]);
});

test("changing the home mode, level, kind or user invalidates stale preparation", t => {
  const disposed: TrainingRuntime[] = [];
  t.mock.method(TrainingRuntime.prototype, "load", async () => ({
    words: [], stats: [], planner: null as unknown as TrainingPlanner,
  }));
  t.mock.method(TrainingRuntime.prototype, "dispose", function (this: TrainingRuntime) {
    disposed.push(this);
  });
  const cache = new HomeTrainingPreloader();
  cache.warm(selection);
  cache.warm({ ...selection, modes: ["exam"] });
  assert.equal(disposed.length, 1);
  assert.equal(cache.take(selection), null);
  cache.warm({ ...selection, levels: "1,2" });
  cache.warm({ ...selection, kinds: ["meaning"] });
  cache.warm({ ...selection, owner: "user-b" });
  assert.equal(disposed.length, 4);
  assert.equal(cache.take(selection), null);
  assert.ok(cache.take({ ...selection, owner: "user-b" }));
  assert.notEqual(homeTrainingKey(selection), homeTrainingKey({ ...selection, owner: "user-b" }));
});
