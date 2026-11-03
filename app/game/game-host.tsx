"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type Phaser from "phaser";
import { useSettings } from "@/app/settings";
import type { Answer, Stat, Word } from "@/lib/game/core";
import {
  flushAnswers,
  queueAnswer,
  readWords,
  readWordCache,
  mergeWords,
} from "@/lib/game/storage";
import { createClient } from "@/lib/supabase/client";
import { parseLevels, selectedDifficulty } from "@/lib/game/selection";
type Bootstrap = { words: Word[]; stats: Stat[]; user_id: string };
export default function GameHost({ previewWords }: { previewWords?: Word[] }) {
  const { prefs, change } = useSettings();
  const router = useRouter();
  const parent = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const preferences = useRef(prefs);
  const changeRef = useRef(change);
  useEffect(() => {
    preferences.current = prefs;
    changeRef.current = change;
  }, [prefs, change]);
  useEffect(() => {
    let cancelled = false,
      game: Phaser.Game | undefined,
      owner = "",
      ended = false;
    const answers: Answer[] = [];
    const writes: Promise<unknown>[] = [];
    const levels = parseLevels(new URLSearchParams(window.location.search).get("levels"));
    const difficulties = selectedDifficulty(levels);
    const includePersonal = levels.includes("P");
    const filterCommon = (words: Word[]) => words.filter(word => difficulties.has(word.difficulty));
    async function fetchData(): Promise<Bootstrap> {
      const sets = await Promise.all([
        difficulties.size ? fetchCommon() : Promise.resolve(null),
        includePersonal ? fetchPersonal() : Promise.resolve(null),
      ]);
      const present = sets.filter((set): set is Bootstrap => set !== null);
      if (!present.length) throw Error("WORDS");
      if (present.some(set => set.user_id !== present[0].user_id)) throw Error("LOGIN");
      return { user_id: present[0].user_id, words: present.flatMap(set => set.words),
        stats: [...new Map(present.flatMap(set => set.stats).map(stat => [stat.word_id, stat])).values()] };
    }
    async function fetchPersonal(): Promise<Bootstrap> {
      const response = await fetch("/api/game/bootstrap?source=personal", { cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (response.status === 401) { router.replace("/"); throw Error("LOGIN"); }
      if (!response.ok) throw Error("LOAD");
      const data = await response.json() as Bootstrap & { synced_at: string };
      const personal = data.words.map(word => ({ ...word, source: "personal" as const }));
      const words = await mergeWords(undefined, personal, data.synced_at, `personal-word-v1:${data.user_id}`);
      return { ...data, words };
    }
    async function fetchCommon(): Promise<Bootstrap> {
      const cached = await readWordCache().catch(() => undefined);
      const query = cached ? `?since=${encodeURIComponent(cached.syncedAt)}` : "";
      const response = await fetch(`/api/game/bootstrap${query}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (response.status === 401) {
        router.replace("/");
        throw Error("LOGIN");
      }
      if (!response.ok) throw Error("LOAD");
      const data = await response.json() as Bootstrap & { synced_at: string; reset: boolean };
      const words = await mergeWords(data.reset ? undefined : cached, data.words, data.synced_at);
      return { ...data, words: filterCommon(words) };
    }
    async function sync() {
      if (previewWords) return true;
      try {
        await Promise.allSettled(writes);
        await Promise.all(answers.map((a) => queueAnswer(owner, a)));
        await flushAnswers(owner);
        answers.length = 0;
        writes.length = 0;
        return true;
      } catch {
        return false;
      }
    }
    const online = () => {
      if (ended) void sync();
    };
    window.addEventListener("online", online);
    async function init() {
      let data: Bootstrap;
      if (previewWords)
        data = { words: previewWords, stats: [], user_id: "preview" };
      else {
        try {
          data = await fetchData();
        } catch (e) {
          if ((e as Error).message === "LOGIN") return;
          const {
            data: { session },
          } = await createClient().auth.getSession();
          if (!session) throw Error("LOAD");
          const [common, personal] = await Promise.all([
            difficulties.size ? readWords().catch(() => undefined) : Promise.resolve([]),
            includePersonal ? readWordCache(`personal-word-v1:${session.user.id}`).then(cache => cache?.words).catch(() => undefined) : Promise.resolve([]),
          ]);
          if (!common || !personal) throw Error("LOAD");
          data = { words: [...filterCommon(common), ...personal], stats: [], user_id: session.user.id };
        }
      }
      owner = data.user_id;
      let sources = new Map(data.words.map(word => [word.id, word.source]));
      if (!previewWords) {
        // Recovery after a killed tab must never gate creation of the next game.
        // Only acknowledged answers are removed; failed uploads remain queued.
        void flushAnswers(owner).catch(() => {});
      }
      if (cancelled || !parent.current) return;
      if (data.words.length < 4) throw Error("WORDS");
      await document.fonts.ready;
      const { createTraining } = await import("@/lib/game/scene");
      if (cancelled || !parent.current) return;
      game = createTraining(parent.current, {
        words: data.words,
        stats: data.stats,
        preferences: preferences.current,
        preview: !!previewWords,
        onPreferences: (p) => changeRef.current(p),
        onAnswer: (a) => {
          const answer: Answer = { ...a,
            source: sources.get(a.word_id) === "personal" ? "personal" : "word",
            selected_source: a.selected_word_id && sources.get(a.selected_word_id) === "personal" ? "personal" : "word" };
          answers.push(answer);
          if (!previewWords) {
            const write = queueAnswer(owner, answer);
            writes.push(write);
            void write.catch(() => {});
          }
        },
        onFinish: async () => {
          ended = true;
          const ok = await sync();
          return ok;
        },
        onRetry: async () => {
          ended = false;
          if (previewWords) return { words: previewWords, stats: [] };
          await sync();
          try {
            const fresh = await fetchData();
            if (fresh.user_id !== owner) {
              router.replace("/");
              throw Error("LOGIN");
            }
            data = fresh;
            sources = new Map(data.words.map(word => [word.id, word.source]));
            return { words: fresh.words, stats: fresh.stats };
          } catch {
            return { words: data.words, stats: [] };
          }
        },
        onExit: () => router.push("/"),
      });
      setLoaded(true);
    }
    void init().catch((e) => {
      if (!cancelled) setError((e as Error).message);
    });
    return () => {
      cancelled = true;
      window.removeEventListener("online", online);
      game?.destroy(true);
    };
  }, [previewWords, router]);
  const t = (jp: string, kr: string) => (prefs.lang === "jp" ? jp : kr);
  return (
    <main className="game-viewport">
      <div className="game-canvas" ref={parent} />
      {!loaded && (
        <div className="game-loading">
          <strong>速読 / Sokudoku</strong>
          <p role="status">
            {error
              ? error === "WORDS"
                ? t(
                    "選択した範囲には少なくとも4語必要です。Pは個人単語です。",
                    "선택한 범위에 단어가 최소 4개 필요합니다. P는 개인 단어입니다.",
                  )
                : t(
                    "接続を確認して、もう一度お試しください。",
                    "연결을 확인하고 다시 시도해주세요.",
                  )
              : t("トレーニングを準備中…", "훈련 준비 중…")}
          </p>
          {error && <Link href="/">{t("ホームへ", "홈으로")}</Link>}
        </div>
      )}
    </main>
  );
}
