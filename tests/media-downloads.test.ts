import test from "node:test";
import assert from "node:assert/strict";
import { MediaDownloads } from "../lib/sync/media";
import { battleImages, battleReady } from "../lib/game/phaser/presentation-assets";

test("home prefetch and game share one bounded download, prioritizing queued game files", async () => {
  const releases = new Map<string, () => void>(), started: string[] = [];
  let active = 0, peak = 0;
  const downloads = new MediaDownloads({
    read: async () => undefined, write: async () => {},
    fetch: async url => {
      started.push(url); peak = Math.max(peak, ++active);
      await new Promise<void>(resolve => releases.set(url, resolve));
      active--; return new Blob([url]);
    },
  }, 2);
  const warm = downloads.warm(["image-a", "image-b", "later", "needed"]);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(started, ["image-a", "image-b"]);
  const a = downloads.get("image-a"), game = downloads.get("needed");
  releases.get("image-a")!(); await a;
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(started, ["image-a", "image-b", "needed"]);
  releases.get("needed")!(); assert.equal(await (await game).text(), "needed");
  await new Promise(resolve => setImmediate(resolve));
  releases.get("image-b")!(); releases.get("later")!();
  assert.equal(await warm, true); assert.equal(peak, 2);
  assert.equal(started.filter(url => url === "image-a").length, 1);
});

test("hash-addressed cached files survive downloader recreation; only new hashes fetch", async () => {
  const cache = new Map<string, Blob>(); let fetches = 0;
  const storage = { read: async (url: string) => cache.get(url),
    write: async (url: string, blob: Blob) => { cache.set(url, blob); },
    fetch: async (url: string) => { fetches++; return new Blob([url]); } };
  await new MediaDownloads(storage).get("/hash-a.webp");
  const next = new MediaDownloads(storage);
  assert.equal(await (await next.get("/hash-a.webp")).text(), "/hash-a.webp");
  assert.equal(fetches, 1);
  await next.get("/hash-b.webp"); assert.equal(fetches, 2);
});

test("a failed file does not stop other media and retries without repeating cached successes", async () => {
  const cache = new Map<string, Blob>(); let fail = true;
  const counts = new Map<string, number>();
  const downloads = new MediaDownloads({ read: async url => cache.get(url),
    write: async (url, blob) => { cache.set(url, blob); },
    fetch: async url => {
      counts.set(url, (counts.get(url) ?? 0) + 1);
      if (url === "broken" && fail) throw Error("offline");
      return new Blob([url]);
    } });
  assert.equal(await downloads.warm(["good", "broken", "other"]), false);
  fail = false;
  assert.equal(await downloads.warm(["good", "broken", "other"]), true);
  assert.equal(counts.get("good"), 1); assert.equal(counts.get("broken"), 2);
});

test("storage denial still allows media to play", async () => {
  const downloads = new MediaDownloads({ read: async () => { throw Error("denied"); },
    write: async () => { throw Error("quota"); }, fetch: async () => new Blob(["image"]) });
  assert.equal(await (await downloads.get("hash")).text(), "image");
});

test("battle presentation waits for its complete compatible image group", () => {
  const ready = new Set(battleImages.slice(1).map(([key]) => key as string));
  assert.equal(battleReady(key => ready.has(key)), false);
  ready.add(battleImages[0][0]); assert.equal(battleReady(key => ready.has(key)), true);
});
