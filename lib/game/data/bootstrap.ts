import type { Word, Stat } from "../types";
import { parseLevels, selectedDifficulty } from "../selection";
import { readWords, readWordCache, mergeWords } from "./word-cache";
import { createClient } from "@/lib/supabase/client";

export type Bootstrap = { words: Word[]; stats: Stat[]; user_id: string };

/** One loader per game route. Owns selected sources, incremental cache and offline fallback. */
export class GameDataLoader {
  private difficulties: Set<number>;
  private includePersonal: boolean;
  constructor(
    levels: string | null,
    private onLoginRequired: () => void,
  ) {
    const selected = parseLevels(levels);
    this.difficulties = selectedDifficulty(selected);
    this.includePersonal = selected.includes("P");
  }
  private filterCommon(words: Word[]) {
    return words.filter((word) => this.difficulties.has(word.difficulty));
  }
  async fetchData(): Promise<Bootstrap> {
    const sets = await Promise.all([
      this.difficulties.size ? this.fetchCommon() : Promise.resolve(null),
      this.includePersonal ? this.fetchPersonal() : Promise.resolve(null),
    ]);
    const present = sets.filter((set): set is Bootstrap => set !== null);
    if (!present.length) throw Error("WORDS");
    if (present.some((set) => set.user_id !== present[0].user_id))
      throw Error("LOGIN");
    return {
      user_id: present[0].user_id,
      words: present.flatMap((set) => set.words),
      stats: [
        ...new Map(
          present
            .flatMap((set) => set.stats)
            .map((stat) => [stat.word_id, stat]),
        ).values(),
      ],
    };
  }
  async fetchPersonal(): Promise<Bootstrap> {
    const response = await fetch("/api/game/bootstrap?source=personal", {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 401) {
      this.onLoginRequired();
      throw Error("LOGIN");
    }
    if (!response.ok) throw Error("LOAD");
    const data = (await response.json()) as Bootstrap & { synced_at: string };
    const personal = data.words.map((word) => ({
      ...word,
      source: "personal" as const,
    }));
    const words = await mergeWords(
      undefined,
      personal,
      data.synced_at,
      `personal-word-v1:${data.user_id}`,
    );
    return { ...data, words };
  }
  async fetchCommon(): Promise<Bootstrap> {
    const cached = await readWordCache().catch(() => undefined);
    const query = cached ? `?since=${encodeURIComponent(cached.syncedAt)}` : "";
    const response = await fetch(`/api/game/bootstrap${query}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 401) {
      this.onLoginRequired();
      throw Error("LOGIN");
    }
    if (!response.ok) throw Error("LOAD");
    const data = (await response.json()) as Bootstrap & {
      synced_at: string;
      reset: boolean;
    };
    const words = await mergeWords(
      data.reset ? undefined : cached,
      data.words,
      data.synced_at,
    );
    return { ...data, words: this.filterCommon(words) };
  }

  async loadOffline(): Promise<Bootstrap> {
    const {
      data: { session },
    } = await createClient().auth.getSession();
    if (!session) throw Error("LOAD");
    const [common, personal] = await Promise.all([
      this.difficulties.size
        ? readWords().catch(() => undefined)
        : Promise.resolve([]),
      this.includePersonal
        ? readWordCache(`personal-word-v1:${session.user.id}`)
            .then((cache) => cache?.words)
            .catch(() => undefined)
        : Promise.resolve([]),
    ]);
    if (!common || !personal) throw Error("LOAD");
    return {
      words: [...this.filterCommon(common), ...personal],
      stats: [],
      user_id: session.user.id,
    };
  }
}
