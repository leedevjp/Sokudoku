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
  const [selecting, setSelecting] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function refreshMembership() {
    const response = await fetch("/api/notebook", { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Error("LOAD");
    const data: { words: NotebookWord[] } = await response.json();
    setWords(data.words);
    setSelected(previous => previous ? data.words.find(w => w.id === previous.id && w.source === previous.source) ?? null : null);
    setPage(previous => Math.min(previous, Math.max(1, Math.ceil(data.words.length / NOTEBOOK_PAGE_SIZE))));
  }
  async function removePersonal(word: NotebookWord) {
    const entry = word.personal_entry;
    if (busy || !entry) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/personal/${entry.id}`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updated_at: entry.updated_at }), signal: AbortSignal.timeout(15000),
      });
      if (!response.ok && response.status !== 404) {
        if (response.status === 409) {
          await refreshMembership();
          setMessage(t("単語が更新されています。確認して再試行してください。", "단어가 변경됐어요. 내용을 확인하고 다시 시도해주세요."));
          return;
        }
        throw Error("REMOVE");
      }
      const update = (w: NotebookWord): NotebookWord => w.personal_entry?.id === entry.id ? { ...w, in_personal: false, personal_entry: null } : w;
      setWords(previous => previous?.filter(w => !(w.source === "personal" && w.id === entry.id)).map(update) ?? null);
      setSelected(previous => previous?.source === "personal" ? null : previous ? update(previous) : null);
      setMessage(t("Pから解除しました。", "P에서 해제했어요."));
      try { await refreshMembership(); } catch { /* The successful deletion is already reflected locally. */ }
    } catch { setMessage(t("解除できませんでした。再試行してください。", "해제하지 못했어요. 다시 시도해주세요.")); }
    finally { setBusy(false); }
  }
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
      try { await refreshMembership(); } catch { /* Keep the successful add result; reload restores removal details. */ }
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
            <div className={styles.toolbar}>
              <span className={styles.caption}>{selecting ? t(`${checked.length}語を選択`, `${checked.length}개 선택됨`) : t("単語をタップして詳細へ", "단어를 누르면 상세 보기")}</span>
              <button className={styles.textButton} disabled={busy || (!selecting && !eligible.length)} onClick={() => { setSelecting(!selecting); setChecked([]); }}>
                {selecting ? t("キャンセル", "취소") : t("選択", "선택")}
              </button>
            </div>
            {selecting && <div className={styles.selectionTools}>
              <button className={styles.textButton} disabled={busy || !eligible.length} onClick={() => setChecked(checked.length === eligible.length ? [] : eligible.map(w => w.id))}>
                {checked.length === eligible.length ? t("すべて解除", "전체 해제") : t("すべて選択", "전체 선택")}
              </button>
              <span>{t(`全ページの追加可能な${eligible.length}語`, `전체 페이지 · 추가 가능한 ${eligible.length}개`)}</span>
            </div>}
            {message && <p className={styles.feedback} role="status">{message}</p>}
            <div className={`notebook-columns ${selecting ? styles.selectingColumns : ""}`} aria-hidden="true">
              <span>{t("単語", "단어")}</span><span>{t("読み方", "읽기")}</span><span>{t("意味", "뜻")}</span>
            </div>
            <ul className="notebook-list">
              {visible.map(word => {
                const available = !!word.can_add_personal && !word.in_personal;
                const content = <>
                  <span className="notebook-term" lang="ja">{word.term}{word.in_personal && <small aria-label={t("Pに登録済み", "P에 있음")}>P</small>}</span>
                  <span className="notebook-kana" lang="ja">{word.kana}</span>
                  <span className="notebook-meaning" lang="ko">{choiceLabel(word, "meaning")}</span>
                </>;
                return <li key={`${word.source}:${word.id}`}>
                  {selecting ? <label className={`${styles.selectableRow} ${checked.includes(word.id) ? styles.checked : ""} ${!available ? styles.unavailable : ""}`}>
                    <input type="checkbox" className={styles.checkbox} checked={checked.includes(word.id)} disabled={busy || !available} aria-label={t(`${word.term}を選択`, `${word.term} 선택`)} onChange={e => setChecked(previous => e.target.checked ? [...previous, word.id] : previous.filter(id => id !== word.id))} />
                    <span className={styles.rowContent}>{content}</span>
                  </label> : <button className="notebook-row" onClick={() => { setMessage(""); setSelected(word); }} aria-haspopup="dialog">{content}</button>}
                </li>;
              })}
            </ul>
            {selecting && <div className={styles.bottomBar}>
              <span aria-live="polite">{t(`${checked.length}語を選択`, `${checked.length}개 선택`)}</span>
              <button className={styles.addButton} disabled={busy || !checked.length} onClick={() => void addPersonal(checked)}>{busy ? t("追加中…", "추가 중…") : t("Pに追加", "P에 추가")}</button>
            </div>}
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
      <WordDetail key={selected ? `${selected.source}:${selected.id}` : "closed"} word={selected} onClose={() => setSelected(null)} busy={busy} message={message} onAdd={id => void addPersonal([id])} onRemove={word => void removePersonal(word)} />
    </main>
  );
}
