import { useEffect, useState } from "react";
import type { DashboardData } from "@/lib/dashboard/types";

/** Request ownership, cancellation and retry stay separate from chart rendering. */
export function useDashboardData() {
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
  function retry() {
    setError(null);
    setData(null);
    setReload((n) => n + 1);
  }
  return { data, error, retry };
}
