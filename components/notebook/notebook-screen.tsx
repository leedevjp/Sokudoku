"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SettingsBar } from "@/components/settings/settings-bar";
import { useSettings } from "@/components/settings/settings-provider";
import { choiceLabel } from "@/lib/game/rules";
import { NOTEBOOK_PAGE_SIZE, type NotebookWord } from "@/lib/notebook/types";
import styles from "./personal-actions.module.css";
import { WordDetail } from "./word-detail";

export default function NotebookScreen() {
  const { prefs } = useSettings();
  const t = (jp: string, kr: string) => (prefs.lang === "jp" ? jp : kr);
  const [words, setWords] = useState<NotebookWord[] | null>(null);
  const [error, setError] = useState<"login" | "load" | null>(null);
  const [reload, setReload] = useState(0);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<NotebookWord | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function addPersonal(ids: string[]) {
    if (busy || !ids.length) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/notebook/personal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }), signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw Error("SAVE");
      const { results } = await response.json() as { results: { id: string; status: string }[] };
      const saved = new Set(results.filter(r => r.status === "added" || r.status === "exists").map(r => r.id));
      const update = (w: NotebookWord): NotebookWord => saved.has(w.id) ? { ...w, in_personal: true } : w;
      setWords(previous => previous?.map(update) ?? null);
      setSelected(previous => previous ? update(previous) : null);
      setChecked(previous => previous.filter(id => !saved.has(id)));
      const added = results.filter(r => r.status === "added").length;
      setMessage(t(`追加 ${added}・登録済み ${saved.size-added}・未追加 ${results.length-saved.size}`, `추가 ${added}개 · 기존 ${saved.size-added}개 · 미추가 ${results.length-saved.size}개`));
    } catch { setMessage(t("追加できませんでした。再試行してください。", "추가하지 못했어요. 다시 시도해주세요.")); }
    finally { setBusy(false); }
  }
  const eligible = words?.filter(w => w.can_add_personal && !w.in_personal) ?? [];
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
            <div className={styles.actions}>
              <label><input type="checkbox" disabled={busy || !eligible.length} checked={eligible.length > 0 && checked.length === eligible.length} onChange={e => setChecked(e.target.checked ? eligible.map(w => w.id) : [])} />{t("全ページから選択", "전체 페이지에서 선택")} ({eligible.length})</label>
              <button className="primary" disabled={busy || !checked.length} onClick={() => void addPersonal(checked)}>{busy ? t("追加中…", "추가 중…") : t(`選択した ${checked.length} 語をPに追加`, `선택한 ${checked.length}개 P에 추가`)}</button>
            </div>
            <p role="status" aria-live="polite">{message}</p>
            <div className="notebook-columns" aria-hidden="true">
              <span>{t("単語", "단어")}</span>
              <span>{t("読み方", "읽기")}</span>
              <span>{t("意味", "뜻")}</span>
            </div>
            <ul className="notebook-list">
              {visible.map((word) => (
                <li key={`${word.source}:${word.id}`}>
                  {word.can_add_personal && !word.in_personal && <label className={styles.select}><input type="checkbox" disabled={busy} checked={checked.includes(word.id)} onChange={e => setChecked(previous => e.target.checked ? [...previous, word.id] : previous.filter(id => id !== word.id))} />{word.term} {t("選択", "선택")}</label>}
                  {word.in_personal && word.source !== "personal" && <small>{t("Pに登録済み", "P에 있음")}</small>}
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
      <WordDetail word={selected} onClose={() => setSelected(null)} busy={busy} message={message} onAdd={id => void addPersonal([id])} />
    </main>
  );
}
