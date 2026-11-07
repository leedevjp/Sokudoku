"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type Phaser from "phaser";
import { GameLoading } from "@/components/game/game-loading";
import { useSettings } from "@/components/settings/settings-provider";
import type { Word } from "@/lib/game/types";
import { parseModes } from "@/lib/game/learning/types";
import { parseKinds } from "@/lib/game/selection";
import { TrainingRuntime } from "@/lib/game/data/training-runtime";

/** Connects React lifecycle and preferences to the dynamically loaded game. */
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
    let cancelled = false;
    let game: Phaser.Game | undefined;
    let readyTimer: ReturnType<typeof setTimeout> | undefined;
    const query = new URLSearchParams(window.location.search);
    const kinds = parseKinds(query.get("kinds"));
    const runtime = new TrainingRuntime({
      levels: query.get("levels"),
      kinds,
      modes: parseModes(query.get("modes")),
      previewWords,
      onLoginRequired: () => router.replace("/"),
    });
    const online = () => runtime.online();
    window.addEventListener("online", online);
    async function init() {
      await Promise.resolve();
      if (cancelled) return;
      setLoaded(false);
      setError("");
      const data = await runtime.load();
      await document.fonts.ready;
      const { createTraining } = await import(
        "@/lib/game/phaser/create-training"
      );
      if (cancelled || !parent.current) return;
      readyTimer = setTimeout(() => {
        if (!cancelled) setError("START");
      }, 15000);
      game = createTraining(parent.current, {
        ...data,
        kinds,
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
      });
    }
    void init().catch((error) => {
      if (!cancelled) setError((error as Error).message);
    });
    return () => {
      cancelled = true;
      clearTimeout(readyTimer);
      window.removeEventListener("online", online);
      game?.destroy(true);
      runtime.dispose();
    };
  }, [previewWords, router]);
  return (
    <main className="game-viewport">
      <div className="game-canvas" ref={parent} />
      {(!loaded || error) && <GameLoading error={error} lang={prefs.lang} />}
    </main>
  );
}
