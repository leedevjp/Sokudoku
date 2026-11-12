"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SettingsBar } from "@/components/settings/settings-bar";
import { useSettings } from "@/components/settings/settings-provider";
import { choiceLabel } from "@/lib/game/rules";
import { NOTEBOOK_PAGE_SIZE, type NotebookWord } from "@/lib/notebook/types";
import styles from "./personal-actions.module.css";
import { queryNotebook, defaultNotebookQuery, type NotebookQuery } from "@/lib/notebook/query";
import { NotebookControls } from "./notebook-controls";
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
  const [query, setQuery] = useState<NotebookQuery>(defaultNotebookQuery);
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
      const existing = saved.size - added;
      const failed = results.length - saved.size;
      setMessage([
        added ? t(`${added}語をPに追加しました。`, `${added}개를 P에 추가했어요.`) : "",
        existing ? t(`登録済み ${existing}語`, `이미 등록된 ${existing}개`) : "",
        failed ? t(`未追加 ${failed}語。再試行できます。`, `미추가 ${failed}개. 다시 시도할 수 있어요.`) : "",
      ].filter(Boolean).join(" "));
    } catch { setMessage(t("追加できませんでした。再試行してください。", "추가하지 못했어요. 다시 시도해주세요.")); }
    finally { setBusy(false); }
  }
  const filtered = queryNotebook(words ?? [], query);
  const eligible = filtered.filter(w => w.can_add_personal && !w.in_personal);
  const activeChecked = checked.filter(id => eligible.some(w => w.id === id));
  function changeQuery(patch: Partial<NotebookQuery>) {
    setQuery(previous => ({ ...previous, ...patch }));
    setPage(1); setChecked([]); setMessage("");
  }
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
  const pages = Math.max(1, Math.ceil(filtered.length / NOTEBOOK_PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * NOTEBOOK_PAGE_SIZE, currentPage * NOTEBOOK_PAGE_SIZE);
  return (
    <main className={`site-shell notebook-shell ${styles.shell}`}>
      <header className="site-header">
        <Link className="brand" href="/">
          <span className="brand-mark">速</span>Sokudoku
          <span className="brand-dot">.</span>
        </Link>
        <SettingsBar />
      </header>
      <section className={styles.content} aria-labelledby="notebook-title">
        <div className={styles.heading}>
          <Link href="/" className={styles.back} aria-label={t("ホームへ戻る", "메인으로 돌아가기")}>←</Link>
          <h1 id="notebook-title">{t("まちがいノート", "오답노트")}</h1>
          {!!words?.length && !error && <button className={styles.modeButton} disabled={busy || (!selecting && !eligible.length)} onClick={() => { setSelecting(!selecting); setChecked([]); setMessage(""); }}>
            {selecting ? t("キャンセル", "취소") : t("Pに追加", "P에 추가")}
          </button>}
        </div>
        {words !== null && !error && <NotebookControls query={query} onChange={changeQuery} count={filtered.length} total={words.length} disabled={busy} t={t} />}
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
            {selecting && <div className={styles.selectionTools} role="group" aria-label={t("単語の選択", "단어 선택 도구")}>
              <span className={styles.selectionCount} aria-live="polite">{t(`${activeChecked.length}語`, `${activeChecked.length}개`)}<small>{t("選択", "선택")}</small></span>
              <button className={styles.textButton} disabled={busy || !eligible.length} title={t(`絞り込み結果の${eligible.length}語を選択`, `검색·필터 결과 전체에서 추가 가능한 ${eligible.length}개 선택`)} onClick={() => setChecked(activeChecked.length === eligible.length ? [] : eligible.map(w => w.id))}>
                {activeChecked.length === eligible.length ? t("すべて解除", "전체 해제") : t("すべて選択", "전체 선택")}
              </button>
              <button className={styles.addButton} disabled={busy || !activeChecked.length} onClick={() => void addPersonal(activeChecked)}>{busy ? t("追加中…", "추가 중…") : t(`選択した${activeChecked.length}語を追加`, `선택한 ${activeChecked.length}개 추가`)}</button>
            </div>}
            {message && !selected && <div className={styles.feedback} role="status"><span>{message}</span><button onClick={() => setMessage("")} aria-label={t("通知を閉じる", "알림 닫기")}>×</button></div>}
            {!filtered.length && <div className={styles.noResults} role="status">
              <strong>{t("見つかりませんでした", "검색 결과가 없어요")}</strong>
              <button className={styles.textButton} onClick={() => changeQuery(defaultNotebookQuery)}>{t("検索・絞り込みを解除", "검색·필터 초기화")}</button>
            </div>}
            {!!filtered.length && <ul className={styles.list}>
              {visible.map(word => {
                const available = !!word.can_add_personal && !word.in_personal;
                const content = <>
                  <span className={styles.identity}>
                    <span className={styles.term} lang="ja">{word.term}{word.in_personal && <small className={styles.badge} aria-label={t("Pに登録済み", "P에 있음")}>P</small>}</span>
                    {word.kana !== word.term && <span className={styles.kana} lang="ja">{word.kana}</span>}
                  </span>
                  <span className={styles.meaning} lang="ko">{choiceLabel(word, "meaning")}</span>
                </>;
                return <li key={`${word.source}:${word.id}`}>
                  {selecting ? <label className={`${styles.selectableRow} ${activeChecked.includes(word.id) ? styles.checked : ""} ${!available ? styles.unavailable : ""}`}>
                    <input type="checkbox" className={styles.checkbox} checked={activeChecked.includes(word.id)} disabled={busy || !available} aria-label={t(`${word.term}を選択`, `${word.term} 선택`)} onChange={e => setChecked(previous => e.target.checked ? [...previous, word.id] : previous.filter(id => id !== word.id))} />
                    <span className={styles.rowContent}>{content}</span>
                  </label> : <button className={styles.wordRow} onClick={() => { setMessage(""); setSelected(word); }} aria-haspopup="dialog"><span className={styles.rowContent}>{content}</span><span className={styles.chevron} aria-hidden="true">›</span></button>}
                </li>;
              })}
            </ul>}
            {pages > 1 && <nav
              className={styles.pagination}
              aria-label={t("ノートのページ", "오답노트 페이지")}
            >
              <button
                disabled={currentPage === 1}
                onClick={() => { setPage(currentPage - 1); setMessage(""); document.getElementById("notebook-title")?.scrollIntoView({ block: "start" }); }}
              >
                ← {t("前へ", "이전")}
              </button>
              <span role="status" aria-live="polite">
                {currentPage} / {pages}
              </span>
              <button
                disabled={currentPage === pages}
                onClick={() => { setPage(currentPage + 1); setMessage(""); document.getElementById("notebook-title")?.scrollIntoView({ block: "start" }); }}
              >
                {t("次へ", "다음")} →
              </button>
            </nav>}
          </>
        )}
      </section>
      <WordDetail key={selected ? `${selected.source}:${selected.id}` : "closed"} word={selected} onClose={() => setSelected(null)} busy={busy} message={message} onAdd={id => void addPersonal([id])} onRemove={word => void removePersonal(word)} />
    </main>
  );
}
