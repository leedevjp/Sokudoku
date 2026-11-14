"use client";
import { useEffect, useState } from "react";
import { NOTEBOOK_PAGE_SIZE, type NotebookWord } from "@/lib/notebook/types";
import { queryNotebook, defaultNotebookQuery, type NotebookQuery } from "@/lib/notebook/query";

/**
 * Notebook fetching, membership mutations, selection and pagination.
 * The screen only renders the current state; API flows stay in one hook.
 */
export function useNotebookState(t: (jp: string, kr: string) => string) {
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
        added ? t(`${added}語をマイ単語帳に追加しました。`, `${added}개를 내 단어장에 추가했어요.`) : "",
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
  return {
    words, setWords, error, setError, setReload, page, setPage, selected, setSelected,
    selecting, setSelecting, checked, setChecked, busy, query, message, setMessage,
    filtered, eligible, activeChecked, changeQuery, removePersonal, addPersonal,
    pages, currentPage, visible,
  };
}
