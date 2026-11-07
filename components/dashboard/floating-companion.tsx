"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { DashboardSummary } from "@/lib/dashboard/summary";
import { companionFocusKey, companionMessage, visibleCompanionSection, type CompanionFocus, type CompanionSection } from "@/lib/dashboard/companion";
import css from "./dashboard-companion.module.css";
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
function sectionOf(target: EventTarget | null) {
  return target instanceof Element ? target.closest<HTMLElement>("[data-companion-section]")?.dataset.companionSection as CompanionSection | undefined : undefined;
}
function detailOf(target: EventTarget | null): Partial<CompanionFocus> {
  if (!(target instanceof Element)) return {};
  const day = target.closest<HTMLElement>("[data-companion-day]")?.dataset.companionDay;
  const band = target.closest<HTMLElement>("[data-companion-band]")?.dataset.companionBand;
  const level = target.closest<HTMLElement>("[data-companion-level]")?.dataset.companionLevel;
  return day ? { day } : band !== undefined ? { band: Number(band) }
    : level && !(target.closest("summary") && target.closest("details")?.open) ? { level } : {};
}
export function DashboardCompanion({ summary, lang, children }: { summary: DashboardSummary; lang: string; children: ReactNode }) {
  const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const root = useRef<HTMLDivElement>(null), floating = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ focus: { section: "overview" } as CompanionFocus, variant: 0 });
  const current = useRef(view);
  const visits = useRef(new Map([["overview:::", 0]]));
  const [speaking, setSpeaking] = useState(true);
  const activate = useCallback((focus: CompanionFocus, manual = false) => {
    const old = current.current;
    if (!manual && focus.section === old.focus.section) return;
    const key = companionFocusKey(focus);
    if (key === companionFocusKey(old.focus)) return;
    const next = { focus, variant: (visits.current.get(key) ?? -1) + 1 };
    visits.current.set(key, next.variant); current.current = next; setView(next);
  }, []);
  const place = useCallback((focusY?: number) => {
    if (!floating.current || !root.current) return;
    const viewport = window.visualViewport, height = viewport?.height ?? innerHeight, width = viewport?.width ?? innerWidth;
    const offset = viewport?.offsetTop ?? 0;
    const x = Math.max(8, Math.min(width - 80, root.current.getBoundingClientRect().right + 12));
    const y = Math.max(offset + 150, Math.min(offset + height - 110, (focusY ?? offset + height / 2) + 44));
    floating.current.style.left = `${x}px`; floating.current.style.top = `${y}px`;
  }, []);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0; place();
      const offset = window.visualViewport?.offsetTop ?? 0, height = window.visualViewport?.height ?? innerHeight;
      const rects = [...(root.current?.querySelectorAll<HTMLElement>("[data-companion-section]") ?? [])].map(el => {
        const rect = el.getBoundingClientRect();
        return { section: el.dataset.companionSection as CompanionSection, top: rect.top - offset, bottom: rect.bottom - offset };
      });
      const section = visibleCompanionSection(rects, height);
      if (section) {
        const center = offset + height / 2;
        const detail = [...(root.current?.querySelectorAll<HTMLElement>("[data-companion-level], [data-companion-band]") ?? [])].find(el => {
          const rect = el.getBoundingClientRect();
          return sectionOf(el) === section && rect.top <= center && rect.bottom >= center;
        });
        activate({ section, ...(detail ? detailOf(detail) : {}) }, true);
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true }); window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule); window.visualViewport?.addEventListener("scroll", schedule);
    const observer = new ResizeObserver(schedule); if (root.current) observer.observe(root.current);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule); window.visualViewport?.removeEventListener("scroll", schedule);
    };
  }, [activate, place]);
  const cheer = () => {
    const next = { ...current.current, variant: current.current.variant + 1 };
    visits.current.set(companionFocusKey(next.focus), next.variant); current.current = next; setView(next); setSpeaking(true);
  };
  return <>
    <div ref={root} className={css.group}
      onPointerOverCapture={event => {
        if (event.pointerType !== "mouse" || sectionOf(event.target) === sectionOf(event.relatedTarget)) return;
        const section = sectionOf(event.target); if (section) { activate({ section }); place(event.clientY); }
      }}
      onClickCapture={event => {
        const section = sectionOf(event.target); if (section) { activate({ section, ...detailOf(event.target) }, true); place(event.clientY); }
      }}
      onFocusCapture={event => {
        if (!event.target.matches(":focus-visible")) return;
        const section = sectionOf(event.target); if (section) { activate({ section, ...detailOf(event.target) }, true); place(event.target.getBoundingClientRect().top); }
      }}>{children}</div>
    {mounted && createPortal(<div ref={floating} className={css.floating} data-companion-overlay="true">
      {speaking && <div className={css.bubble}>
        <span className={css.bubbleName}>{lang === "jp" ? "小さな応援団" : "작은 응원단"}</span>
        <p id="companion-speech" data-companion-message={view.focus.section} aria-live="off">{companionMessage(summary, view.focus, lang, view.variant)}</p>
        <button className={css.dismiss} onClick={() => setSpeaking(false)} aria-label={lang === "jp" ? "吹き出しを閉じる" : "말풍선 접기"}>×</button>
      </div>}
      <button type="button" className={css.friend} data-companion-sprite={view.focus.section}
        aria-label={lang === "jp" ? "もうひとこと応援してもらう" : "응원 한마디 더 듣기"}
        aria-describedby={speaking ? "companion-speech" : undefined} onClick={cheer}>
        <span key={view.variant + companionFocusKey(view.focus)} className={css.sprite} aria-hidden="true" />
      </button>
    </div>, document.body)}
  </>;
}
