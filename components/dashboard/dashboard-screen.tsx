"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSettings } from "@/components/settings/settings-provider";
import type { EntryType, Kind } from "@/lib/game/types";
import type { Translate } from "@/lib/dashboard/types";
import { dashboardSummary } from "@/lib/dashboard/summary";
import { MemoryDistribution } from "./memory-distribution";
import { ActivityChart } from "./activity-chart";
import { StageProgress } from "./stage-progress";
import styles from "./dashboard-styles";
import { useDashboardData } from "./use-dashboard-data";
import { DashboardFilters } from "./dashboard-filters";
import { DashboardState } from "./dashboard-state";
import { SummaryCards } from "./summary-cards";
import { DashboardCompanion } from "./floating-companion";
import companionCss from "./dashboard-companion.module.css";

export default function DashboardScreen() {
  const { prefs, change } = useSettings();
  const t: Translate = (jp, kr) => (prefs.lang === "jp" ? jp : kr);
  const [entry, setEntry] = useState<EntryType>("word");
  const [kind, setKind] = useState<Kind>("meaning");
  const [companionMode, setCompanionMode] = useState<"fixed" | "follow">("fixed");
  useEffect(() => {
    try { if (localStorage.getItem("sokudoku-companion-mode") === "follow") setCompanionMode("follow"); } catch {}
  }, []);
  const toggleCompanion = () => setCompanionMode(old => {
    const next = old === "fixed" ? "follow" : "fixed";
    try { localStorage.setItem("sokudoku-companion-mode", next); } catch {}
    return next;
  });
  const companionToggle = (location: "top" | "bottom") => (
    <button type="button" className={companionCss.modeToggle} onClick={toggleCompanion}
      aria-label={companionMode === "fixed" ? t("キャラクターを追従させる", "캐릭터 이동 모드로 전환") : t("キャラクターを固定する", "캐릭터 고정 모드로 전환")}
      title={companionMode === "fixed" ? t("固定中 · クリックで追従", "고정 중 · 클릭하면 이동") : t("追従中 · クリックで固定", "이동 중 · 클릭하면 고정")}
      aria-pressed={companionMode === "fixed"} data-companion-toggle={location}>
      <span aria-hidden="true">{companionMode === "fixed" ? "🔒" : "🔓"}</span>
    </button>
  );

  const { data, error, retry } = useDashboardData();
  const actualKind = entry === "word" ? kind : "meaning";
  const summary = useMemo(() => data ? dashboardSummary(data, entry, actualKind) : null,
    [data, entry, actualKind]);
  const scope =
    entry === "word"
      ? t("単語", "단어") +
        " · " +
        (actualKind === "meaning" ? t("意味", "뜻") : t("読み", "읽기"))
      : entry === "hiragana"
        ? t("ひらがな", "히라가나")
        : t("カタカナ", "가타카나");
  const unit = entry === "word" ? t("語", "개") : t("字", "자");
  const number = (n: number) =>
    n.toLocaleString(prefs.lang === "jp" ? "ja-JP" : "ko-KR");
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link
          className={styles.iconButton}
          href="/"
          aria-label={t("ホーム", "메인으로")}
        >
          <svg
            aria-hidden="true"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="m14 5-7 7 7 7"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <h1>{t("学習状況", "학습 현황")}</h1>
        {companionToggle("top")}
        <button
          className={styles.language}
          onClick={() => change({ lang: prefs.lang === "jp" ? "kr" : "jp" })}
          aria-label="KR / JP"
        >
          {prefs.lang === "kr" ? "KR ⇄ JP" : "JP ⇄ KR"}
        </button>
        <button
          className={styles.iconButton}
          onClick={() =>
            change({ theme: prefs.theme === "dark" ? "light" : "dark" })
          }
          aria-label={t("テーマを切り替える", "테마 전환")}
        >
          {prefs.theme === "dark" ? "☀" : "☾"}
        </button>
      </header>
      <DashboardFilters
        entry={entry}
        kind={kind}
        scope={scope}
        t={t}
        onEntryChange={setEntry}
        onKindChange={setKind}
      />
      <div aria-live="polite" aria-busy={!data && !error}>
        {error || !summary ? (
          <DashboardState error={error} summary={summary} t={t} retry={retry} />
        ) : (
          <DashboardCompanion key={entry + ":" + actualKind} summary={summary} lang={prefs.lang} mode={companionMode}>
          <div data-companion-section="overview" className={styles.sections}>
            {summary.learned === 0 ? <DashboardState error={null} summary={summary} t={t} retry={retry} /> :
            <SummaryCards
              summary={summary}
              entry={entry}
              unit={unit}
              t={t}
              number={number}
            />
            }
          </div>
          {summary.learned > 0 && <>
            <MemoryDistribution counts={summary.memory} scope={scope} t={t} />
            <ActivityChart
              summary={summary}
              scope={scope}
              t={t}
              lang={prefs.lang}
            />
            <StageProgress
              summary={summary}
              entry={entry}
              scope={scope}
              t={t}
            />
          </>}
          </DashboardCompanion>
        )}
      </div>
      <div className={companionCss.bottomToggle}>{companionToggle("bottom")}</div>
      {data && (
        <footer className={styles.footer}>
          {new Date(data.updated_at).toLocaleTimeString(
            prefs.lang === "jp" ? "ja-JP" : "ko-KR",
            { hour: "2-digit", minute: "2-digit" },
          )}{" "}
          {t(
            "現在 · 未送信の回答はまだ反映されない場合があります。",
            "기준 · 아직 서버에 저장되지 않은 답변은 반영되지 않을 수 있어요.",
          )}
        </footer>
      )}
    </main>
  );
}
