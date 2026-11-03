import test from "node:test";
import assert from "node:assert/strict";
import { settingsStore } from "../lib/settings-store";

test("settings restore once, notify subscribers and survive blocked storage", () => {
  const previousStorage = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const events = new EventTarget();
  let raw: string | null = JSON.stringify({ lang: "kr", theme: "dark" });
  let blocked = false;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: events,
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () => {
        if (blocked) throw Error("denied");
        return raw;
      },
      setItem: (_key: string, value: string) => {
        if (blocked) throw Error("denied");
        raw = value;
      },
    },
  });
  try {
    const restored = settingsStore.getSnapshot();
    assert.deepEqual(restored, { lang: "kr", theme: "dark" });
    assert.equal(
      settingsStore.getSnapshot(),
      restored,
      "unchanged snapshots must not trigger render loops",
    );
    let notifications = 0;
    const unsubscribe = settingsStore.subscribe(() => notifications++);
    settingsStore.change({ theme: "light" });
    assert.deepEqual(settingsStore.getSnapshot(), {
      lang: "kr",
      theme: "light",
    });
    assert.deepEqual(JSON.parse(raw!), { lang: "kr", theme: "light" });
    assert.equal(notifications, 1);
    raw = JSON.stringify({ lang: "jp", theme: "dark" });
    events.dispatchEvent(
      Object.assign(new Event("storage"), { key: "sokudoku-preferences" }),
    );
    assert.deepEqual(settingsStore.getSnapshot(), {
      lang: "jp",
      theme: "dark",
    });
    assert.equal(notifications, 2);
    unsubscribe();
    blocked = true;
    settingsStore.change({ lang: "kr" });
    assert.deepEqual(settingsStore.getSnapshot(), {
      lang: "kr",
      theme: "dark",
    });
    assert.equal(
      notifications,
      2,
      "unmounted subscribers must not be notified",
    );
  } finally {
    if (previousStorage)
      Object.defineProperty(globalThis, "localStorage", previousStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
    if (previousWindow)
      Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
