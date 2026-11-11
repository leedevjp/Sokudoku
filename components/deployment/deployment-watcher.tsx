"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const LOCAL_BUILD = process.env.NEXT_PUBLIC_SOKUDOKU_BUILD_ID ?? "development";
const BUILD_TIME = process.env.NEXT_PUBLIC_SOKUDOKU_BUILD_TIME;
const COMMIT = process.env.NEXT_PUBLIC_SOKUDOKU_BUILD_COMMIT ?? "";
const RELOAD_KEY = "sokudoku-deployment-auto-reload";

function canReload(pathname: string): boolean {
  // Never interrupt a training run, pause overlay, result save, or editing form.
  if (pathname !== "/" && pathname !== "/dashboard") return false;
  if (document.querySelector('[role="dialog"], input:focus, textarea:focus, [contenteditable="true"]:focus')) return false;
  return true;
}

export function DeploymentWatcher() {
  const pathname = usePathname();

  useEffect(() => {
    if (LOCAL_BUILD === "development") return;
    let closed = false;
    let busy = false;

    async function check() {
      if (closed || busy || document.hidden || !navigator.onLine) return;
      busy = true;
      try {
        const response = await fetch(`/api/version?_t=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!response.ok || closed) return;
        const data: unknown = await response.json();
        if (!data || typeof data !== "object" || !("id" in data)) return;
        const newId = (data as { id?: unknown }).id;
        if (typeof newId !== "string" || newId === "development" || newId === LOCAL_BUILD) return;
        if (!canReload(window.location.pathname)) return;
        try {
          if (sessionStorage.getItem(RELOAD_KEY) === newId) return;
          sessionStorage.setItem(RELOAD_KEY, newId);
        } catch {
          // Private browsing can block sessionStorage. Reload still works.
        }
        window.location.reload();
      } catch {
        // Offline, failed deployment, or transient errors: retry later.
      } finally {
        busy = false;
      }
    }

    // Check on initial mount and whenever navigating back to a safe screen.
    void check();
    const interval = window.setInterval(() => { void check(); }, 60_000);
    const onVisible = () => {
      if (!document.hidden) void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      closed = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [pathname]);

  return null;
}

export function DeploymentLabel({ lang }: { lang: "jp" | "kr" }) {
  if (!BUILD_TIME) return null;
  const date = new Date(BUILD_TIME);
  if (Number.isNaN(date.valueOf())) return null;
  const formatted = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);
  const label = lang === "jp" ? "最終更新" : "최종 업데이트";
  const hash = COMMIT && COMMIT !== "local" ? ` · ${COMMIT.slice(0, 7)}` : "";
  return (
    <span className="home-deploy-label" title={`${label}: ${formatted} JST${hash}`}>
      {label} · {formatted} JST{hash}
    </span>
  );
}
