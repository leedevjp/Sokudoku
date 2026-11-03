"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type Phaser from "phaser";
import { useSettings } from "@/app/settings";
import type { Word } from "@/lib/game/types";
import { parseModes } from "@/lib/game/learning/types";
import { LearningEngine } from "@/lib/game/learning/engine";
import { TrainingPlanner } from "@/lib/game/learning/planner";
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
    const modes = parseModes(
      new URLSearchParams(window.location.search).get("modes"),
    );
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
      if (!modes.length) throw Error("MODES");
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
      let planner = new TrainingPlanner(
        await LearningEngine.create(data.learning),
        data.words,
        kinds,
        modes,
      );
      if (!planner.hasQuestions())
        throw Error(
          modes.length === 1 && modes[0] === "review"
            ? "REVIEW_EMPTY"
            : "WORDS",
        );
      await document.fonts.ready;
      const { createTraining } = await import(
        "@/lib/game/phaser/create-training"
      );
      if (cancelled || !parent.current) return;
      game = createTraining(parent.current, {
        kinds,
        planner,
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
            planner = new TrainingPlanner(
              await LearningEngine.create(fresh.learning),
              fresh.words,
              kinds,
              modes,
            );
            return { words: fresh.words, stats: fresh.stats, planner };
          } catch {
            return { words: data.words, stats: [], planner };
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
              ? error === "REVIEW_EMPTY"
                ? t(
                    "いま復習する単語はありません。探索で学習するか、時間をおいてお試しください。",
                    "지금 복습할 단어가 없어요. 탐색으로 학습하거나 나중에 다시 시도해주세요.",
                  )
                : error === "MODES"
                  ? t(
                      "探索・復習を選んでください。",
                      "탐색·복습을 선택해주세요.",
                    )
                  : error === "KINDS"
                    ? t(
                        "問題タイプを選んでください。",
                        "문제 유형을 선택해주세요.",
                      )
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
