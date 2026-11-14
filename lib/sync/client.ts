import { createClient } from "../supabase/client";
import type { Bootstrap } from "../game/data/bootstrap";
import type { Kind } from "../game/types";

let worker: Worker | undefined;
let owner: string | null | undefined;
let nextId = 0;
let savedAt = 0;
const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = ({ data }) => {
    if (data.type === "updated" && data.owner === owner && data.savedAt !== savedAt) {
      savedAt = data.savedAt;
      window.dispatchEvent(new CustomEvent("sokudoku-sync-updated", { detail: { catalogVersion: data.catalogVersion } }));
    }
    const request = pending.get(data.id);
    if (!request) return;
    pending.delete(data.id); clearTimeout(request.timer);
    if (data.error) request.reject(Error(data.error)); else request.resolve(data.result);
  };
  worker.onerror = () => {
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(Error("SYNC_WORKER")); }
    pending.clear(); worker?.terminate(); worker = undefined;
  };
  if (owner) worker.postMessage({ type: "owner", owner });
  return worker;
}
export function setSyncOwner(value: string | null) {
  if (value === owner && worker) return;
  for (const request of pending.values()) { clearTimeout(request.timer); request.reject(Error("OWNER_CHANGED")); }
  pending.clear(); owner = value; savedAt = 0;
  if (value || worker) getWorker().postMessage({ type: "owner", owner: value });
}
async function identify() {
  if (owner === undefined) {
    const { data } = await createClient().auth.getSession();
    if (owner === undefined) setSyncOwner(data.session?.user.id ?? null);
  }
  if (!owner) throw Error("LOGIN");
  // Recover a failed worker without changing the current identity.
  if (!worker) getWorker().postMessage({ type: "owner", owner });
}
async function request(type: string, args: object = {}): Promise<unknown> {
  await identify();
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(Error("SYNC_TIMEOUT")); }, 150000);
    pending.set(id, { resolve, reject, timer });
    getWorker().postMessage({ id, type, ...args });
  });
}
export async function prepareSharedGame(levels: string | null, kinds: Kind[]): Promise<Bootstrap> {
  return await request("prepare", { levels, kinds }) as Bootstrap;
}
export async function settleSync() { await request("sync"); }
export function kickSync() {
  if (typeof window === "undefined") return;
  if (owner) getWorker().postMessage({ type: "kick" });
}
