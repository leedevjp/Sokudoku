"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
type Bootstrap = { words: Word[]; stats: Stat[]; user_id: string };
export default function GameHost({ previewWords }: { previewWords?: Word[] }) {
  const { prefs, change } = useSettings();
  const router = useRouter();
  const parent = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const preferences = useRef(prefs);
  preferences.current = prefs;
  const changeRef = useRef(change);
  changeRef.current = change;
  useEffect(() => {
    let cancelled = false,
      game: Phaser.Game | undefined,
      owner = "",
      ended = false;
    const answers: Answer[] = [];
    const writes: Promise<unknown>[] = [];
    async function fetchData(): Promise<Bootstrap> {
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
      return { ...data, words };
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
          const words = await readWords().catch(() => undefined);
          if (!session || !words) throw Error("LOAD");
          data = { words, stats: [], user_id: session.user.id };
        }
      }
      owner = data.user_id;
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
          answers.push(a);
          if (!previewWords) {
            const write = queueAnswer(owner, a);
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
                    "選択肢を作るための単語が不足しています。",
                    "선택지를 만들 단어가 부족합니다.",
                  )
                : t(
                    "接続を確認して、もう一度お試しください。",
                    "연결을 확인하고 다시 시도해주세요.",
                  )
              : t("トレーニングを準備中…", "훈련 준비 중…")}
          </p>
          {error && <a href="/">{t("ホームへ", "홈으로")}</a>}
        </div>
      )}
    </main>
  );
}
