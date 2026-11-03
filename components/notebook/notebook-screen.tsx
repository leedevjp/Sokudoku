"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SettingsBar, useSettings } from "@/app/settings";
import { choiceLabel } from "@/lib/game/rules";
import { NOTEBOOK_PAGE_SIZE, type NotebookWord } from "@/lib/notebook/types";
import { WordDetail } from "./word-detail";

export default function NotebookScreen() {
  const { prefs } = useSettings();
  const t = (jp: string, kr: string) => (prefs.lang === "jp" ? jp : kr);
  const [words, setWords] = useState<NotebookWord[] | null>(null);
  const [error, setError] = useState<"login" | "load" | null>(null);
  const [reload, setReload] = useState(0);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<NotebookWord | null>(null);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    async function load() {
      try {
        const response = await fetch("/api/notebook", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 401) {
          if (!cancelled) setError("login");
          return;
        }
        if (!response.ok) throw Error("LOAD");
        const data: { words: NotebookWord[] } = await response.json();
        if (!cancelled) setWords(data.words);
      } catch {
        if (!cancelled) setError("load");
      } finally {
        clearTimeout(timeout);
      }
    }
    void load();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [reload]);
  const pages = Math.ceil((words?.length ?? 0) / NOTEBOOK_PAGE_SIZE);
  const visible =
    words?.slice((page - 1) * NOTEBOOK_PAGE_SIZE, page * NOTEBOOK_PAGE_SIZE) ??
    [];
  return (
    <main className="site-shell notebook-shell">
      <header className="site-header">
        <Link className="brand" href="/">
          <span className="brand-mark">速</span>Sokudoku
          <span className="brand-dot">.</span>
        </Link>
        <SettingsBar />
      </header>
      <section className="notebook-content" aria-labelledby="notebook-title">
        <Link href="/" className="notebook-back">
          ← {t("ホーム", "메인으로")}
        </Link>
        <div className="notebook-heading">
          <h1 id="notebook-title">{t("まちがいノート", "오답노트")}</h1>
          {words && (
            <span>
              {words.length}
              {t("語", "개")}
            </span>
          )}
        </div>
        <p className="notebook-description">
          {t(
            "誤答・時間切れの単語を、最近の100語まで。タップで詳しく。",
            "틀렸거나 시간 초과된 최근 단어 최대 100개. 누르면 자세히 볼 수 있어요.",
          )}
        </p>
        {error ? (
          <div className="notebook-state" role="status">
            <p>
              {error === "login"
                ? t(
                    "ログインしてノートを開いてください。",
                    "로그인하면 오답노트를 볼 수 있어요.",
                  )
                : t(
                    "読み込めませんでした。接続を確認してください。",
                    "불러오지 못했어요. 연결을 확인해주세요.",
                  )}
            </p>
            {error === "login" ? (
              <Link className="primary" href="/">
                {t("ログインへ", "로그인하러 가기")}
              </Link>
            ) : (
              <button
                className="primary"
                onClick={() => {
                  setError(null);
                  setWords(null);
                  setPage(1);
                  setReload((value) => value + 1);
                }}
              >
                {t("再試行", "다시 시도")}
              </button>
            )}
          </div>
        ) : words === null ? (
          <p className="notebook-state" role="status">
            {t("ノートを開いています…", "오답노트를 불러오는 중…")}
          </p>
        ) : words.length === 0 ? (
          <div className="notebook-state" role="status">
            <strong>✦</strong>
            <p>
              {t(
                "まだまちがえた単語はありません。",
                "아직 기록된 오답 단어가 없어요.",
              )}
            </p>
            <Link className="primary" href="/">
              {t("トレーニングへ", "트레이닝하러 가기")}
            </Link>
          </div>
        ) : (
          <>
            <div className="notebook-columns" aria-hidden="true">
              <span>{t("単語", "단어")}</span>
              <span>{t("読み方", "읽기")}</span>
              <span>{t("意味", "뜻")}</span>
            </div>
            <ul className="notebook-list">
              {visible.map((word) => (
                <li key={`${word.source}:${word.id}`}>
                  <button
                    className="notebook-row"
                    onClick={() => setSelected(word)}
                    aria-haspopup="dialog"
                  >
                    <span className="notebook-term" lang="ja">
                      {word.term}
                      {word.source === "personal" && (
                        <small aria-label={t("個人単語", "개인 단어")}>P</small>
                      )}
                    </span>
                    <span className="notebook-kana" lang="ja">
                      {word.kana}
                    </span>
                    <span className="notebook-meaning" lang="ko">
                      {choiceLabel(word, "meaning")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <nav
              className="notebook-pagination"
              aria-label={t("ノートのページ", "오답노트 페이지")}
            >
              <button
                disabled={page === 1}
                onClick={() => setPage((value) => value - 1)}
              >
                ← {t("前へ", "이전")}
              </button>
              <span role="status" aria-live="polite">
                {page} / {pages}
              </span>
              <button
                disabled={page === pages}
                onClick={() => setPage((value) => value + 1)}
              >
                {t("次へ", "다음")} →
              </button>
            </nav>
          </>
        )}
      </section>
      <WordDetail word={selected} onClose={() => setSelected(null)} />
    </main>
  );
}
