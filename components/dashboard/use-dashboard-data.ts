import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DashboardData } from "@/lib/dashboard/types";
import { settleSync } from "@/lib/sync/client";

type DashboardError = "login" | "load" | null;
type SavedDashboard = { savedAt: number; data: DashboardData };
const CACHE_PREFIX = "sokudoku-dashboard-v1:";

/** A cached dashboard belongs to one signed-in user and one timezone. */
function cacheKey(userId: string, timezone: string) {
  return CACHE_PREFIX + userId + ":" + timezone;
}
function validDashboard(value: unknown): value is DashboardData {
  if (!value || typeof value !== "object") return false;
  const d = value as Partial<DashboardData>;
  return typeof d.today === "string" && typeof d.updated_at === "string" &&
    Array.isArray(d.groups) && Array.isArray(d.activity);
}
function loadSaved(key: string): DashboardData | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedDashboard;
    // Very old results are misleading, even with a visible refresh indicator.
    if (!saved || typeof saved.savedAt !== "number" ||
        Date.now() - saved.savedAt > 7 * 24 * 60 * 60 * 1000 ||
        !validDashboard(saved.data)) {
      localStorage.removeItem(key);
      return null;
    }
    return saved.data;
  } catch {
    return null;
  }
}
function save(key: string, data: DashboardData) {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data } satisfies SavedDashboard));
  } catch {
    // Storage may be unavailable or full; online dashboard still works.
  }
}

/** Render last verified figures immediately, then revalidate in the background. */
export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<DashboardError>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    async function load() {
      setRefreshing(true);
      setError(null);
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        // Only use a cache after identifying the current session's user.
        // The server still authenticates and authorizes every network request.
        const { data: auth, error: authError } = await createClient().auth.getSession();
        if (!active) return;
        if (authError || !auth.session?.user.id) {
          setData(null);
        } else {
          const key = cacheKey(auth.session.user.id, timezone);
          const saved = loadSaved(key);
          if (saved) setData(saved);
          else setData(null);
        }
        // Keep showing the cached screen while the shared worker reconciles both directions.
        void settleSync().catch(() => { /* Keep the existing online refresh independent. */ });
        const response = await fetch("/api/dashboard?timezone=" + encodeURIComponent(timezone), {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!active) return;
        if (response.status === 401) {
          setData(null);
          setError("login");
          return;
        }
        if (!response.ok) throw Error("LOAD");
        const result: unknown = await response.json();
        if (!validDashboard(result)) throw Error("INVALID_DASHBOARD");
        if (!active) return;
        setData(result);
        setError(null);
        // Never save under an unverified or different account.
        if (!authError && auth.session?.user.id) {
          save(cacheKey(auth.session.user.id, timezone), result);
        }
      } catch {
        if (active) setError("load");
      } finally {
        clearTimeout(timer);
        if (active) setRefreshing(false);
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [reload]);
  useEffect(() => {
    const refresh = () => setReload(n => n + 1);
    window.addEventListener("sokudoku-sync-updated", refresh);
    return () => window.removeEventListener("sokudoku-sync-updated", refresh);
  }, []);

  function retry() {
    setError(null);
    // Keep the current data in place while retrying.
    setReload(n => n + 1);
  }
  return { data, error, refreshing, retry };
}
