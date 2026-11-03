"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type Phaser from "phaser";
import { useSettings } from "@/app/settings";
import type { Word } from "@/lib/game/types";
import { parseKinds, wordsForKinds } from "@/lib/game/selection";
import { AnswerJournal } from "@/lib/game/data/answer-journal";
import { GameDataLoader, type Bootstrap } from "@/lib/game/data/bootstrap";
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
    let journal: AnswerJournal | undefined;
    const kinds = parseKinds(
      new URLSearchParams(window.location.search).get("kinds"),
    );
    const filterWords = (data: Bootstrap): Bootstrap => ({
      ...data,
      words: wordsForKinds(data.words, kinds),
    });
    const loader = new GameDataLoader(
      new URLSearchParams(window.location.search).get("levels"),
      () => router.replace("/"),
    );
    const online = () => {
      if (ended) void journal?.sync();
    };
    window.addEventListener("online", online);
    async function init() {
      if (!kinds.length) throw Error("KINDS");
      let data: Bootstrap;
      if (previewWords)
        data = { words: previewWords, stats: [], user_id: "preview" };
      else {
        try {
          data = await loader.fetchData();
        } catch (e) {
          if ((e as Error).message === "LOGIN") return;
          data = await loader.loadOffline();
        }
      }
      data = filterWords(data);
      owner = data.user_id;
      journal = new AnswerJournal(owner, data.words, !!previewWords);
      journal.recover();
      if (cancelled || !parent.current) return;
      if (data.words.length < 4) throw Error("WORDS");
      await document.fonts.ready;
      const { createTraining } = await import(
        "@/lib/game/phaser/create-training"
      );
      if (cancelled || !parent.current) return;
      game = createTraining(parent.current, {
        kinds,
        words: data.words,
        stats: data.stats,
        preferences: preferences.current,
        preview: !!previewWords,
        onPreferences: (p) => changeRef.current(p),
        onAnswer: (answer) => journal!.record(answer),
        onFinish: async () => {
          ended = true;
          const ok = await journal!.sync();
          return ok;
        },
        onRetry: async () => {
          ended = false;
          if (previewWords)
            return { words: wordsForKinds(previewWords, kinds), stats: [] };
          await journal!.sync();
          try {
            const fresh = filterWords(await loader.fetchData());
            if (fresh.user_id !== owner) {
              router.replace("/");
              throw Error("LOGIN");
            }
            data = fresh;
            journal!.setWords(data.words);
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
              ? error === "KINDS"
                ? t("問題タイプを選んでください。", "문제 유형을 선택해주세요.")
                : error === "WORDS"
                  ? t(
                      "選択した範囲・問題タイプには少なくとも4語必要です。読み方には漢字を含む単語を使います。",
                      "선택한 범위·유형에 단어가 최소 4개 필요합니다. 읽기에는 한자가 있는 단어를 사용합니다.",
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
