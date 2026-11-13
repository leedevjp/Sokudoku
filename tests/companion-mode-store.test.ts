import test from "node:test";
import assert from "node:assert/strict";
import { companionModeStore as store } from "../lib/dashboard/companion-mode-store";

test("companion mode restores safely, notifies tabs and survives blocked storage", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const events = new EventTarget();
  let raw: string | null = "follow", blocked = false, notifications = 0;
  let unsubscribe = () => {};
  Object.defineProperty(globalThis, "window", { configurable: true, value: events });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: () => { if (blocked) throw Error("blocked"); return raw; },
    setItem: (_key: string, value: string) => { if (blocked) throw Error("blocked"); raw = value; },
  } });
  try {
    assert.equal(store.getServerSnapshot(), "fixed");
    assert.equal(store.getSnapshot(), "follow");
    unsubscribe = store.subscribe(() => notifications++);
    store.toggle();
    assert.equal(store.getSnapshot(), "fixed");
    assert.equal(raw, "fixed");
    assert.equal(notifications, 1);
    raw = "follow";
    events.dispatchEvent(Object.assign(new Event("storage"), { key: "unrelated" }));
    assert.equal(notifications, 1);
    events.dispatchEvent(Object.assign(new Event("storage"), { key: "sokudoku-companion-mode-v2" }));
    assert.equal(notifications, 2);
    assert.equal(store.getSnapshot(), "follow");
    blocked = true;
    store.toggle();
    assert.equal(store.getSnapshot(), "fixed");
    store.toggle();
    assert.equal(store.getSnapshot(), "follow");
    blocked = false;
    raw = null;
    events.dispatchEvent(Object.assign(new Event("storage"), { key: null }));
    assert.equal(store.getSnapshot(), "fixed");
    raw = "invalid";
    assert.equal(store.getSnapshot(), "fixed");
    unsubscribe();
    const before = notifications;
    events.dispatchEvent(Object.assign(new Event("storage"), { key: null }));
    store.toggle();
    assert.equal(notifications, before);
    assert.equal(store.getServerSnapshot(), "fixed");
  } finally {
    unsubscribe();
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow); else Reflect.deleteProperty(globalThis, "window");
    if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage); else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
