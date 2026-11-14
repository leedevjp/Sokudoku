"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { kickSync, setSyncOwner } from "@/lib/sync/client";

/** Mounted in the root layout: navigation never destroys the shared worker. */
export function SyncBridge() {
  const pathname = usePathname();
  useEffect(() => {
    let active = true;
    let identityGeneration = 0;
    try {
      const client = createClient();
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        if (active) { identityGeneration++; setSyncOwner(session?.user.id ?? null); }
      });
      const generation = identityGeneration;
      void client.auth.getSession().then(({ data }) => {
        if (active && identityGeneration === generation) setSyncOwner(data.session?.user.id ?? null);
      }).catch(() => {});
      const wake = () => { if (!document.hidden) kickSync(); };
      window.addEventListener("online", wake);
      window.addEventListener("focus", wake);
      document.addEventListener("visibilitychange", wake);
      return () => {
        active = false; data.subscription.unsubscribe();
        window.removeEventListener("online", wake); window.removeEventListener("focus", wake);
        document.removeEventListener("visibilitychange", wake);
      };
    } catch { /* Pages without a configured account, including previews, still render. */ }
  }, []);
  useEffect(() => {
    if (pathname === "/" || pathname === "/dashboard") kickSync();
    if (pathname === "/") void import("@/lib/game/phaser/create-training").catch(() => {});
    // A prebuilt quiz is useful only while the user is on home or entering
    // the game. Discard its reading worker when navigating elsewhere.
    if (pathname !== "/" && pathname !== "/game")
      void import("@/lib/game/data/home-preloader")
        .then(({ homeTrainingPreloader }) => homeTrainingPreloader.clear())
        .catch(() => {});
  }, [pathname]);
  return null;
}
