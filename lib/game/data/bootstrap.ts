import type { Word, Stat } from "../types";
import {
  parseLevels,
  selectedDifficulty,
  wordMatchesLevels,
  type TrainingLevel,
} from "../selection";
import { readWords, readWordCache, mergeWords } from "./word-cache";
import { createClient } from "@/lib/supabase/client";
import { database, storageDeadline } from "./database";
import { emptyLearning, type LearningSnapshot } from "../learning/types";
import { loadMeaningBank, readMeaningBank } from "./meaning-bank";
import { withMeaningBank } from "../meaning-bank";

export type Bootstrap = {
  words: Word[];
  stats: Stat[];
  user_id: string;
  learning?: LearningSnapshot;
};

/** One loader per game route. Owns selected sources, incremental cache and offline fallback. */
export class GameDataLoader {
  private difficulties: Set<number>;
  private includePersonal: boolean;
  private levels: TrainingLevel[];
  constructor(
    levels: string | null,
    private onLoginRequired: () => void,
    private needsMeaning = true,
  ) {
    const selected = parseLevels(levels);
    this.levels = selected;
    this.difficulties = selectedDifficulty(selected);
    this.includePersonal = selected.includes("P");
  }
  private filterCommon(words: Word[]) {
    return words.filter((word) =>
      wordMatchesLevels(word, this.levels, this.difficulties),
    );
  }
  private bankLevels() {
    return this.levels.filter((level) => /^[1-5]$/.test(level)).join(",");
  }
  async fetchData(): Promise<Bootstrap> {
    const [sets, state] = await Promise.all([
      Promise.all([
        this.difficulties.size ? this.fetchCommon() : Promise.resolve(null),
        this.includePersonal ? this.fetchPersonal() : Promise.resolve(null),
      ]),
      this.fetchLearning(),
    ]);
    const present = sets.filter((set): set is Bootstrap => set !== null);
    if (!present.length) throw Error("WORDS");
    if (present.some((set) => set.user_id !== present[0].user_id))
      throw Error("LOGIN");
    if (state.user_id !== present[0].user_id) throw Error("LOGIN");
    try {
      await storageDeadline(
        (await database()).put(
          "cache",
          state.learning,
          `learning-v1:${state.user_id}`,
        ),
      );
    } catch {
      /* Optional offline snapshot. */
    }
    return {
      user_id: present[0].user_id,
      learning: state.learning,
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
  private async fetchLearning(): Promise<{
    user_id: string;
    learning: LearningSnapshot;
  }> {
    const response = await fetch("/api/game/learning", {
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    if (response.status === 401) {
      this.onLoginRequired();
      throw Error("LOGIN");
    }
    if (!response.ok) throw Error("LOAD");
    return response.json();
  }
  async fetchPersonal(): Promise<Bootstrap> {
    const response = await fetch(
      "/api/game/bootstrap?source=personal&compact=1",
      {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      },
    );
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
    const query = cached
      ? `?compact=1&since=${encodeURIComponent(cached.syncedAt)}`
      : "?compact=1";
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
    const selected = this.filterCommon(words);
    return { ...data, words: this.needsMeaning && this.bankLevels()
      ? withMeaningBank(selected, await loadMeaningBank(this.bankLevels(), this.onLoginRequired))
      : selected };
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
    const selected = this.filterCommon(common);
    const bank = this.needsMeaning && this.bankLevels()
      ? await readMeaningBank(this.bankLevels()).catch(() => undefined) : undefined;
    if (this.needsMeaning && this.bankLevels() && !bank) throw Error("MEANING_BANK");
    return {
      words: [...(bank ? withMeaningBank(selected, bank) : selected), ...personal],
      stats: [],
      user_id: session.user.id,
      learning:
        (await storageDeadline(
          (await database()).get("cache", `learning-v1:${session.user.id}`),
        ).catch(() => undefined)) ?? emptyLearning(),
    };
  }
}
