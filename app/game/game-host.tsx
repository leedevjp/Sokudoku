"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type Phaser from "phaser";
import { TREASURE_UI_ENABLED } from "@/lib/features";
import { GameLoading } from "@/components/game/game-loading";
import { useSettings } from "@/components/settings/settings-provider";
import type { Word } from "@/lib/game/types";
import { parseModes } from "@/lib/game/learning/types";
import { parseKinds } from "@/lib/game/selection";
import styles from "./game-host.module.css";
import { TrainingRuntime } from "@/lib/game/data/training-runtime";

/** Connects React lifecycle and preferences to the dynamically loaded game. */
export default function GameHost({ previewWords }: { previewWords?: Word[] }) {
  const { prefs, change } = useSettings();
  const router = useRouter();
  const search = useSearchParams().toString();
  const parent = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [storedChests, setStoredChests] = useState<number | null>(null);
  const preferences = useRef(prefs);
  const changeRef = useRef(change);
  useEffect(() => {
    preferences.current = prefs;
    changeRef.current = change;
  }, [prefs, change]);
  useEffect(() => {
    let cancelled = false;
    let game: Phaser.Game | undefined;
    let noticeTimer: ReturnType<typeof setTimeout> | undefined;
    const rewardRequests = new AbortController();
    let readyTimer: ReturnType<typeof setTimeout> | undefined;
    const query = new URLSearchParams(search);
    const kinds = parseKinds(query.get("kinds"));
    const timeLimited = query.get("timeLimit") !== "off";
    const runtime = new TrainingRuntime({
      levels: query.get("levels"),
      kinds,
      modes: parseModes(query.get("modes")),
      previewWords,
      onLoginRequired: () => router.replace("/"),
      onAnswersSaved: () => {
        if (!TREASURE_UI_ENABLED) return;
        void fetch("/api/treasure", { cache: "no-store", signal: AbortSignal.any([rewardRequests.signal, AbortSignal.timeout(15000)]) })
          .then(async response => {
            if (!response.ok) return;
            const inventory: { pending_count?: number } = await response.json();
            if (cancelled || typeof inventory.pending_count !== "number" || inventory.pending_count < 1) return;
            setStoredChests(inventory.pending_count);
            clearTimeout(noticeTimer);
            noticeTimer = setTimeout(() => setStoredChests(null), 5000);
          }).catch(() => {});
      },
    });
    const online = () => runtime.online();
    window.addEventListener("online", online);
    async function init() {
      await Promise.resolve();
      if (cancelled) return;
      setLoaded(false);
      setError("");
      const [data, , { createTraining }] = await Promise.all([
        runtime.load(),
        document.fonts.ready,
        import("@/lib/game/phaser/create-training"),
      ]);
      if (cancelled || !parent.current) return;
      readyTimer = setTimeout(() => {
        if (!cancelled) setError("START");
      }, 15000);
      game = createTraining(parent.current, {
        ...data,
        kinds,
        timeLimited,
        preferences: preferences.current,
        preview: !!previewWords,
        onReady: () => {
          clearTimeout(readyTimer);
          if (!cancelled) {
            setError("");
            setLoaded(true);
          }
        },
        onError: (error) => {
          clearTimeout(readyTimer);
          console.error("Training initialization failed", error);
          if (!cancelled)
            setError(
              (error as Error)?.message === "QUESTION_BUILD_FAILED"
                ? "QUESTION_BUILD_FAILED"
                : "START",
            );
        },
        onPreferences: (p) => changeRef.current(p),
        onAnswer: (answer) => runtime.record(answer),
        onFinish: () => runtime.finish(),
        onRetry: () => runtime.retry(),
        onExit: () => router.push("/"),
        onExam: () => {
          const params = new URLSearchParams(search);
          params.set("modes", "exam");
          router.push(`/game?${params.toString()}`);
        },
      });
    }
    void init().catch((error) => {
      if (!cancelled) setError((error as Error).message);
    });
    return () => {
      cancelled = true;
      clearTimeout(readyTimer);
      clearTimeout(noticeTimer);
      rewardRequests.abort();
      window.removeEventListener("online", online);
      game?.destroy(true);
      runtime.dispose();
    };
  }, [previewWords, router, search]);
  return (
    <main className="game-viewport">
      <div className="game-canvas" ref={parent} />
      {TREASURE_UI_ENABLED && storedChests !== null && <div className={styles.rewardNotice} role="status">
        <strong>{prefs.lang === "jp" ? `宝箱 ${storedChests}個を保管中` : `보물상자 ${storedChests}개 보관 중`}</strong>
        <span>{prefs.lang === "jp" ? "学習状況で開けられます" : "학습 현황에서 열 수 있어요"}</span>
      </div>}
      {(!loaded || error) && <GameLoading error={error} lang={prefs.lang} />}
    </main>
  );
}
