"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal, preload } from "react-dom";
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
  const topic = target.closest<HTMLElement>("[data-companion-topic]")?.dataset.companionTopic;
  return { ...(day ? { day } : band !== undefined ? { band: Number(band) } : level ? { level } : {}), ...(topic ? { topic } : {}) };
}
export function DashboardCompanion({ summary, lang, children }: { summary: DashboardSummary; lang: string; children: ReactNode }) {
  const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const root = useRef<HTMLDivElement>(null), floating = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ focus: { section: "overview" } as CompanionFocus, variant: 0 });
  const current = useRef(view);
  const visits = useRef(new Map<string, number>());
  const [speaking, setSpeaking] = useState(true);
  const previousPlace = useRef<{ x: number; y: number; target: Element } | null>(null);
  const activate = useCallback((focus: CompanionFocus, manual = false) => {
    const old = current.current;
    if (!manual && focus.section === old.focus.section) return;
    const key = companionFocusKey(focus);
    if (key === companionFocusKey(old.focus)) {
      if (!manual) return;
      const next = { focus, variant: old.variant + 1 };
      current.current = next; setView(next); return;
    }
    const next = { focus, variant: (visits.current.get(key) ?? -1) + 1 };
    visits.current.set(key, next.variant); current.current = next; setView(next);
  }, []);
  const place = useCallback((target?: Element | null) => {
    if (!floating.current || !root.current) return;
    if (!target) return;
    const viewport = window.visualViewport, height = viewport?.height ?? innerHeight, width = viewport?.width ?? innerWidth;
    const offset = viewport?.offsetTop ?? 0;
    const rect = target.getBoundingClientRect();
    const section = sectionOf(target);
    const level = target.closest<HTMLElement>("[data-companion-level]")?.dataset.companionLevel;
    const leftSide = level ? Number(level) % 2 === 0 : section === "memory" || section === "stages";
    const bubbleWidth = Math.min(224, width - 32);
    const minX = leftSide ? 8 : bubbleWidth - 59;
    const maxX = leftSide ? width - bubbleWidth - 13 : width - 80;
    const x = Math.max(minX, Math.min(maxX, leftSide ? rect.left - 46 : rect.right - 26));
    const y = Math.max(offset + 125, Math.min(offset + height - 100, rect.top + Math.min(rect.height, 120) / 2 + 12));
    const old = previousPlace.current;
    const rendered = floating.current.getBoundingClientRect();
    floating.current.getAnimations().forEach(animation => animation.cancel());
    floating.current.dataset.side = leftSide ? "left" : "right";
    floating.current.style.left = `${x}px`; floating.current.style.top = `${y}px`;
    floating.current.dataset.motion = "idle";
    if (old && rendered.left >= 0 && rendered.right <= width && rendered.top >= offset && rendered.bottom <= offset + height && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const distance = Math.hypot(x - rendered.x, y - rendered.y);
      if (distance > 2 && distance < Math.max(1000, height * 1.8)) {
        const element = floating.current;
        const running = distance > 150;
        element.dataset.motion = running ? "run" : "walk";
        element.dataset.direction = x < rendered.x ? "left" : "right";
        const animation = element.animate([
          { transform: `translate(${rendered.x - x}px, ${rendered.y - y}px)` },
          { transform: "translate(0, 0)" },
        ], { duration: Math.max(120, distance / (running ? 430 : 190) * 1000), easing: "linear" });
        animation.onfinish = () => { element.dataset.motion = "idle"; };
      }
      else if (distance >= Math.max(1000, height * 1.8)) floating.current.querySelector("button[data-companion-sprite]")?.animate([
        { filter: "brightness(1.8)", transform: "scale(.85)" },
        { filter: "brightness(1)", transform: "scale(1)" },
      ], { duration: 180, easing: "ease-out" });
    }
    previousPlace.current = { x, y, target };
  }, []);
  useEffect(() => {
    preload("/battle/mage-locomotion-v1.png", { as: "image" });
    const floatingElement = floating.current;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const offset = window.visualViewport?.offsetTop ?? 0, height = window.visualViewport?.height ?? innerHeight;
      const rects = [...(root.current?.querySelectorAll<HTMLElement>("[data-companion-section]") ?? [])].map(el => {
        const rect = el.getBoundingClientRect();
        return { section: el.dataset.companionSection as CompanionSection, top: rect.top - offset, bottom: rect.bottom - offset };
      });
      const section = visibleCompanionSection(rects, height);
      if (section) {
        const center = offset + height / 2;
        const detail = [...(root.current?.querySelectorAll<HTMLElement>("[data-companion-level], [data-companion-band], [data-companion-topic]") ?? [])].find(el => {
          const rect = el.getBoundingClientRect();
          return sectionOf(el) === section && rect.top <= center && rect.bottom >= center;
        });
        activate({ section, ...(detail ? detailOf(detail) : {}) });
        const container = root.current?.querySelector<HTMLElement>(`[data-companion-section="${section}"]`);
        const anchors = [...(container?.querySelectorAll<HTMLElement>("[data-companion-topic],summary,button,p") ?? [])]
          .filter(el => { const r = el.getBoundingClientRect(); return r.height > 0 && r.bottom > offset && r.top < offset + height; });
        anchors.sort((a, b) => {
          const distance = (el: Element) => { const r = el.getBoundingClientRect(); return Math.abs(r.top + r.height / 2 - center); };
          return distance(a) - distance(b);
        });
        place(anchors[0] ?? detail ?? container);
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true }); window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule); window.visualViewport?.addEventListener("scroll", schedule);
    const observer = new ResizeObserver(schedule); if (root.current) observer.observe(root.current);
    return () => {
      floatingElement?.getAnimations().forEach(animation => animation.cancel());
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
        if (event.pointerType !== "mouse" || (sectionOf(event.target) === sectionOf(event.relatedTarget) && (event.target as Element).closest("[data-companion-topic],[data-companion-band],[data-companion-level],[data-companion-day]") === (event.relatedTarget as Element | null)?.closest?.("[data-companion-topic],[data-companion-band],[data-companion-level],[data-companion-day]"))) return;
        const section = sectionOf(event.target); if (section) { activate({ section, ...detailOf(event.target) }); place((event.target as Element).closest("[data-companion-topic],button,summary,p,section")); }
      }}
      onClickCapture={event => {
        const section = sectionOf(event.target); if (section) { activate({ section, ...detailOf(event.target) }, true); place((event.target as Element).closest("[data-companion-topic],button,summary,p,section")); }
      }}
      onFocusCapture={event => {
        if (!event.target.matches(":focus-visible")) return;
        const section = sectionOf(event.target); if (section) { activate({ section, ...detailOf(event.target) }, true); place(event.target); }
      }}>{children}</div>
    {mounted && createPortal(<div ref={floating} className={css.floating} data-companion-overlay="true">
      {speaking && <div className={css.bubble}>
        <p id="companion-speech" data-companion-message={view.focus.section} aria-live="off">{companionMessage(summary, view.focus, lang, view.variant, new Date().getHours())}</p>
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
