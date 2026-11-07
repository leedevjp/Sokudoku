import { MEANING_BANK_VERSION, type MeaningBank } from "../meaning-bank";
import { database, storageDeadline } from "./database";

const keyFor = (levels: string) => `meaning-bank:${MEANING_BANK_VERSION}:${levels}`;
export async function readMeaningBank(levels: string): Promise<MeaningBank | undefined> {
  return storageDeadline((await database()).get("cache", keyFor(levels)));
}
export async function loadMeaningBank(levels: string, onLoginRequired: () => void): Promise<MeaningBank> {
  const cached = await readMeaningBank(levels).catch(() => undefined);
  if (cached) return cached;
  const response = await fetch(`/api/game/meaning-bank?levels=${encodeURIComponent(levels)}`, {
    cache: "no-store", signal: AbortSignal.timeout(30000),
  });
  if (response.status === 401) { onLoginRequired(); throw Error("LOGIN"); }
  if (!response.ok) throw Error("MEANING_BANK");
  const data = await response.json() as { version: string; bank: MeaningBank };
  if (data.version !== MEANING_BANK_VERSION || !data.bank || Array.isArray(data.bank))
    throw Error("MEANING_BANK");
  try {
    await storageDeadline((await database()).put("cache", data.bank, keyFor(levels)));
  } catch { /* The in-memory bank still supports this run. */ }
  return data.bank;
}
