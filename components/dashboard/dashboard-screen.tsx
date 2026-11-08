"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSettings } from "@/components/settings/settings-provider";
import type { EntryType, Kind } from "@/lib/game/types";
import type { Translate } from "@/lib/dashboard/types";
import { dashboardSummary, percentageShares } from "@/lib/dashboard/summary";
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

type DashboardPanel = "overview" | "memory" | "activity" | "stages";
function AccordionPanel({
  section, title, preview, open, onToggle, children,
}: {
  section: DashboardPanel;
  title: string;
  preview: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const panelId = "dashboard-panel-" + section;
  return (
    <section className={companionCss.accordion} data-companion-section={section} data-expanded={open}>
      <button type="button" className={companionCss.accordionButton} data-companion-topic={section === "overview" ? "learned" : undefined}
        onClick={onToggle} aria-expanded={open} aria-controls={panelId}>
        <span className={companionCss.accordionHeading}>
          <strong>{title}</strong>
          <span className={companionCss.accordionPreview}>{preview}</span>
        </span>
        <span className={companionCss.accordionChevron} aria-hidden="true">{open ? "⌃" : "⌄"}</span>
      </button>
      <div id={panelId} className={companionCss.accordionBody} hidden={!open}>
        {open ? children : null}
      </div>
    </section>
  );
}

export default function DashboardScreen() {
  const { prefs, change } = useSettings();
  const t: Translate = (jp, kr) => (prefs.lang === "jp" ? jp : kr);
  const [entry, setEntry] = useState<EntryType>("word");
  const [kind, setKind] = useState<Kind>("meaning");
  const [expandedPanel, setExpandedPanel] = useState<DashboardPanel | null>("memory");
  const [companionMode, setCompanionMode] = useState<"fixed" | "follow">("fixed");
  useEffect(() => {
    try { if (localStorage.getItem("sokudoku-companion-mode") === "follow") setCompanionMode("follow"); } catch {}
  }, []);
  const toggleCompanion = () => setCompanionMode(old => {
    const next = old === "fixed" ? "follow" : "fixed";
    try { localStorage.setItem("sokudoku-companion-mode", next); } catch {}
    return next;
  });
  const companionToggle = () => (
    <button type="button" className={companionCss.modeToggle} onClick={toggleCompanion}
      aria-label={companionMode === "fixed" ? t("キャラクターを追従させる", "캐릭터 이동 모드로 전환") : t("キャラクターを固定する", "캐릭터 고정 모드로 전환")}
      title={companionMode === "fixed" ? t("固定中 · クリックで追従", "고정 중 · 클릭하면 이동") : t("追従中 · クリックで固定", "이동 중 · 클릭하면 고정")}
      aria-pressed={companionMode === "fixed"} data-companion-toggle="top">
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
        {companionToggle()}
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
      <div id="dashboard-companion-home" className={companionCss.companionHome} aria-label={t("キャラクターの応援", "캐릭터 응원")} />
      <div aria-live="polite" aria-busy={!data && !error}>
        {error || !summary ? (
          <DashboardState error={error} summary={summary} t={t} retry={retry} />
        ) : (
          <DashboardCompanion key={entry + ":" + actualKind} summary={summary} lang={prefs.lang} mode={companionMode}>
            <AccordionPanel section="overview" title={t("学習のまとめ", "학습 요약")}
              preview={<>{number(summary.learned)}{unit} {t("学習", "학습")} · {number(summary.attempts)}{t("回回答", "회 답변")}</>}
              open={expandedPanel === "overview"} onToggle={() => setExpandedPanel(old => old === "overview" ? null : "overview")}>
              {summary.learned === 0 ? (
                <DashboardState error={null} summary={summary} t={t} retry={retry} />
              ) : (
                <SummaryCards summary={summary} entry={entry} unit={unit} t={t} number={number} />
              )}
            </AccordionPanel>
            {summary.learned > 0 && <>
              <AccordionPanel section="memory" title={t("記憶の状態", "기억 상태")}
                preview={percentageShares(summary.memory).map((percent, index) =>
                  `${t(["学び始め", "なじみ", "長期"][index], ["처음", "익숙함", "장기"][index])} ${percent}%`
                ).join(" · ")}
                open={expandedPanel === "memory"} onToggle={() => setExpandedPanel(old => old === "memory" ? null : "memory")}>
                <MemoryDistribution counts={summary.memory} scope={scope} t={t} />
              </AccordionPanel>
              <AccordionPanel section="activity" title={t("最近7日間", "최근 7일")}
                preview={<>{number(summary.week.attempts)}{t("回回答", "회 답변")} · {summary.days.filter(d => d.attempts > 0).length}{t("日学習", "일 학습")}</>}
                open={expandedPanel === "activity"} onToggle={() => setExpandedPanel(old => old === "activity" ? null : "activity")}>
                <ActivityChart summary={summary} scope={scope} t={t} lang={prefs.lang} />
              </AccordionPanel>
              <AccordionPanel section="stages"
                title={entry === "word" ? t("段階ごとの状況", "단계별 현황") : t("文字の学習状況", "글자 학습 현황")}
                preview={entry === "word" ? t("1〜5段階 · 個人単語 P", "1~5단계 · 개인 단어 P") : t("かな · 個人単語 P", "가나 · 개인 단어 P")}
                open={expandedPanel === "stages"} onToggle={() => setExpandedPanel(old => old === "stages" ? null : "stages")}>
                <StageProgress summary={summary} entry={entry} scope={scope} t={t} />
              </AccordionPanel>
            </>}
          </DashboardCompanion>
        )}
      </div>
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
