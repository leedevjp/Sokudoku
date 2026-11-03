"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSettings } from "@/app/settings";
import type { EntryType, Kind } from "@/lib/game/types";
import type { DashboardData } from "@/lib/dashboard/types";
import { dashboardSummary } from "@/lib/dashboard/summary";
import { MemoryDistribution } from "./memory-distribution";
import { ActivityChart } from "./activity-chart";
import { StageProgress } from "./stage-progress";
import styles from "./dashboard.module.css";

export type Translate = (jp: string, kr: string) => string;
export default function DashboardScreen() {
  const { prefs, change } = useSettings();
  const t: Translate = (jp, kr) => (prefs.lang === "jp" ? jp : kr);
  const [entry, setEntry] = useState<EntryType>("word");
  const [kind, setKind] = useState<Kind>("meaning");
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<"login" | "load" | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    async function load() {
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const response = await fetch(
          "/api/dashboard?timezone=" + encodeURIComponent(timezone),
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );
        if (response.status === 401) {
          if (active) setError("login");
          return;
        }
        if (!response.ok) throw Error("LOAD");
        const result: DashboardData = await response.json();
        if (active) setData(result);
      } catch {
        if (active) setError("load");
      } finally {
        clearTimeout(timer);
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [reload]);
  const actualKind = entry === "word" ? kind : "meaning";
  const summary = data ? dashboardSummary(data, entry, actualKind) : null;
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
  function retry() {
    setError(null);
    setData(null);
    setReload((n) => n + 1);
  }
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
      <section className={styles.card} aria-label={t("表示範囲", "표시 범위")}>
        <div className={styles.tabs}>
          <button
            aria-pressed={entry === "word"}
            onClick={() => setEntry("word")}
          >
            {t("単語", "단어")}
          </button>
          <button
            aria-pressed={entry !== "word"}
            onClick={() => setEntry("hiragana")}
          >
            {t("かな", "가나")}
          </button>
        </div>
        <div className={styles.pills}>
          {entry === "word"
            ? (["meaning", "reading"] as Kind[]).map((k) => (
                <button
                  key={k}
                  aria-pressed={kind === k}
                  onClick={() => setKind(k)}
                >
                  {k === "meaning" ? t("意味", "뜻") : t("読み", "읽기")}
                </button>
              ))
            : (["hiragana", "katakana"] as EntryType[]).map((e) => (
                <button
                  key={e}
                  aria-pressed={entry === e}
                  onClick={() => setEntry(e)}
                >
                  {e === "hiragana"
                    ? t("ひらがな", "히라가나")
                    : t("カタカナ", "가타카나")}
                </button>
              ))}
        </div>
        <p className={styles.caption}>
          {t("以下の数値の対象：", "아래 숫자의 기준: ")}
          {scope}
        </p>
      </section>
      <div aria-live="polite" aria-busy={!data && !error}>
        {error ? (
          <section className={styles.empty} role="alert">
            <span className={styles.emptyIcon}>↻</span>
            <h2>
              {error === "login"
                ? t("ログインしてください", "로그인이 필요해요")
                : t("読み込めませんでした", "현황을 불러오지 못했어요")}
            </h2>
            <p>
              {t(
                "記録はそのまま残っています。",
                "학습 기록은 그대로 남아 있어요.",
              )}
            </p>
            {error === "login" ? (
              <Link className={styles.cta} href="/?login=1">
                {t("ログインへ", "로그인하기")} →
              </Link>
            ) : (
              <button className={styles.cta} onClick={retry}>
                {t("もう一度試す", "다시 시도하기")} ↻
              </button>
            )}
          </section>
        ) : !summary ? (
          <div
            className={styles.skeleton}
            role="status"
            aria-label={t("読み込み中", "학습 현황 불러오는 중")}
          >
            <div />
            <div />
            <div />
          </div>
        ) : summary.learned === 0 ? (
          <section className={styles.empty}>
            <span className={styles.emptyIcon}>✧</span>
            <h2>
              {summary.hasAnyHistory
                ? t("この範囲はこれから", "이 범위는 이제 시작이에요")
                : t("最初の一歩を始めよう", "첫 학습을 시작해보세요")}
            </h2>
            <p>
              {summary.hasAnyHistory
                ? t(
                    "ほかの範囲の記録は残っています。選択を変えるか、新しく学習してみましょう。",
                    "다른 범위의 기록은 남아 있어요. 선택을 바꾸거나 새로운 학습을 시작해보세요.",
                  )
                : t(
                    "学習すると、ここに記憶の成長が見えてきます。",
                    "학습을 시작하면 이곳에서 기억이 쌓이는 모습을 볼 수 있어요.",
                  )}
            </p>
            <Link className={styles.cta} href="/">
              {t("トレーニングへ", "훈련하러 가기")} →
            </Link>
          </section>
        ) : (
          <div className={styles.sections}>
            <section className={styles.card}>
              <p className={styles.label}>
                {entry === "word"
                  ? t("学習した単語", "학습한 단어")
                  : t("学習した文字", "학습한 글자")}
              </p>
              <div className={styles.headline}>
                <strong>{number(summary.learned)}</strong>
                <span>{unit}</span>
              </div>
              <div className={styles.row}>
                <p className={styles.caption}>
                  {t(
                    "一度以上答えた異なる項目",
                    "한 번 이상 답한 서로 다른 항목",
                  )}
                </p>
                <span className={styles.tag}>
                  {t("全", "전체 ")}
                  {number(summary.total)}
                  {unit}
                </span>
              </div>
              {summary.personal.total > 0 && (
                <p className={styles.caption}>
                  {t("共通", "공통")} {number(summary.common.learned)} ·{" "}
                  {t("個人", "개인")} {number(summary.personal.learned)}
                </p>
              )}
            </section>
            <div className={styles.twoColumns}>
              <section className={styles.card + " " + styles.reviewCard}>
                <p className={styles.label}>
                  {t("いま復習する項目", "지금 복습할 항목")}
                </p>
                <strong className={styles.metric}>
                  {number(summary.review)}
                  <small> {unit}</small>
                </strong>
                <p className={styles.caption}>
                  {t("復習候補に含まれる数", "복습 후보에 해당하는 수")}
                </p>
              </section>
              <section className={styles.card}>
                <p className={styles.label}>{t("累計回答", "누적 답변")}</p>
                <strong className={styles.metric}>
                  {number(summary.attempts)}
                  <small> {t("回", "회")}</small>
                </strong>
                <p className={styles.caption}>
                  {t("正答・誤答・時間切れを含む", "정답·오답·시간 초과 포함")}
                </p>
              </section>
            </div>
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
          </div>
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
