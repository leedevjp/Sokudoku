import type { PersonalStage, PersonalSort } from "@/lib/personal/filters";
import { useEffect, useState } from "react";
import type { PersonalWordList } from "@/lib/personal/types";
import { kickSync } from "@/lib/sync/client";

export function usePersonalWords() {
  const [query, setQuery] = useState("");
  const [request, setRequest] = useState({ q: "", page: 1, revision: 0, stage: "all" as PersonalStage, sort: "recent" as PersonalSort });
  const [result, setResult] = useState<{
    key: string;
    data: PersonalWordList | null;
    error: string | null;
  }>({ key: "", data: null, error: null });
  const key = JSON.stringify(request);
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setRequest((old) =>
          old.q === query.trim() ? old : { ...old, q: query.trim(), page: 1 },
        ),
      300,
    );
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    async function load() {
      try {
        const response = await fetch(
          "/api/personal?q=" +
            encodeURIComponent(request.q) +
            "&page=" +
            request.page + "&stage=" + request.stage + "&sort=" + request.sort,
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) {
          if (active)
            setResult((old) => ({
              ...old,
              key,
              error: response.status === 401 ? "unauthorized" : "load_failed",
            }));
          return;
        }
        const data: PersonalWordList = await response.json();
        if (active) setResult({ key, data, error: null });
      } catch {
        if (active) setResult((old) => ({ ...old, key, error: "load_failed" }));
      } finally {
        clearTimeout(timeout);
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [key, request.q, request.page, request.stage, request.sort]);
  function refresh(reset = false) {
    kickSync();
    if (reset) setQuery("");
    setRequest((old) => ({
      ...old,
      q: reset ? "" : old.q,
      stage: reset ? "all" : old.stage,
      page: reset ? 1 : old.page,
      revision: old.revision + 1,
    }));
  }
  return {
    query,
    setQuery,
    stage: request.stage,
    sort: request.sort,
    setStage: (stage: PersonalStage) => setRequest(old => ({ ...old, stage, page: 1 })),
    setSort: (sort: PersonalSort) => setRequest(old => ({ ...old, sort, page: 1 })),
    data: result.data,
    error: result.key === key ? result.error : null,
    loading: result.key !== key,
    refresh,
    setPage: (page: number) => setRequest((old) => ({ ...old, page })),
  };
}
