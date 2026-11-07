"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type PointerEvent, type FocusEvent, type MouseEvent } from "react";
import type { DashboardSummary } from "@/lib/dashboard/summary";
import { companionMessage, visibleCompanionSection, type CompanionFocus, type CompanionSection } from "@/lib/dashboard/companion";
import css from "./dashboard-companion.module.css";

type View = { focus: CompanionFocus; phase: "out" | "in" | "idle"; variant: number };
type Companion = { view: View; message: string; lang: string; cheer: () => void };
const Context = createContext<Companion | null>(null);
function sectionOf(target: EventTarget | null): CompanionSection | undefined {
  return target instanceof Element ? target.closest<HTMLElement>("[data-companion-section]")?.dataset.companionSection as CompanionSection | undefined : undefined;
}
function detailOf(target: EventTarget | null): Partial<CompanionFocus> {
  if (!(target instanceof Element)) return {};
  const day = target.closest<HTMLElement>("[data-companion-day]")?.dataset.companionDay;
  const band = target.closest<HTMLElement>("[data-companion-band]")?.dataset.companionBand;
  const level = target.closest<HTMLElement>("[data-companion-level]")?.dataset.companionLevel;
  const details = target.closest("details");
  return day ? { day } : band !== undefined ? { band: Number(band) }
    : level && !(target.closest("summary") && details?.open) ? { level } : {};
}

export function DashboardCompanion({ summary, lang, children }: { summary: DashboardSummary; lang: string; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ focus: { section: "overview" }, phase: "in", variant: 0 });
  const current = useRef(view);
  const hover = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const move = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scroll = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lockUntil = useRef(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const publish = useCallback((next: View) => { current.current = next; setView(next); }, []);
  const activate = useCallback((focus: CompanionFocus, manual = false) => {
    if (!manual && performance.now() < lockUntil.current) return;
    clearTimeout(move.current); clearTimeout(settle.current);
    const old = current.current;
    if (manual) {
      clearTimeout(hover.current);
      lockUntil.current = performance.now() + 2200;
    }
    if (focus.section === old.focus.section) {
      if (!manual) { if (old.phase !== "idle") publish({ ...old, phase: "idle" }); return; }
      publish({ ...old, focus, phase: "idle" });
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      publish({ ...old, focus, phase: "idle" }); return;
    }
    publish({ ...old, phase: "out" });
    move.current = setTimeout(() => {
      publish({ focus, phase: "in", variant: 0 });
      settle.current = setTimeout(() => publish({ ...current.current, phase: "idle" }), 450);
    }, 160);
  }, [publish]);
  useEffect(() => {
    settle.current = setTimeout(() => publish({ ...current.current, phase: "idle" }), 650);
    return () => clearTimeout(settle.current);
  }, [publish]);
  useEffect(() => {
    const visible = new Set<Element>();
    const observer = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
    }) : null;
    root.current?.querySelectorAll("[data-companion-section]").forEach(el => observer?.observe(el));
    const onScroll = () => {
      clearTimeout(hover.current); clearTimeout(scroll.current);
      scroll.current = setTimeout(() => {
        const candidates = observer ? [...visible] : [...(root.current?.querySelectorAll("[data-companion-section]") ?? [])];
        const section = visibleCompanionSection(candidates.map(el => {
          const rect = el.getBoundingClientRect();
          return { section: (el as HTMLElement).dataset.companionSection as CompanionSection, top: rect.top, bottom: rect.bottom };
        }), window.innerHeight);
        if (section) activate({ section });
      }, Math.max(420, lockUntil.current - performance.now() + 20));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer?.disconnect(); window.removeEventListener("scroll", onScroll);
      [hover, move, settle, scroll].forEach(timer => clearTimeout(timer.current));
    };
  }, [activate]);
  const pointerOver = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    const section = sectionOf(event.target);
    if (!section || section === sectionOf(event.relatedTarget)) return;
    clearTimeout(hover.current);
    hover.current = setTimeout(() => activate({ section }, true), 480);
  };
  const pointerOut = (event: PointerEvent) => {
    if (sectionOf(event.target) !== sectionOf(event.relatedTarget)) clearTimeout(hover.current);
  };
  const click = (event: MouseEvent) => {
    if ((event.target as Element).closest("[data-companion-sprite]")) return;
    const section = sectionOf(event.target);
    if (section) { clearTimeout(hover.current); activate({ section, ...detailOf(event.target) }, true); }
  };
  const focus = (event: FocusEvent) => {
    if (!(event.target instanceof Element) || !event.target.matches(":focus-visible") || event.target.closest("[data-companion-sprite]")) return;
    const section = sectionOf(event.target);
    if (section) activate({ section, ...detailOf(event.target) }, true);
  };
  const cheer = () => {
    clearTimeout(move.current); clearTimeout(settle.current);
    publish({ ...current.current, variant: current.current.variant + 1, phase: "in" });
    lockUntil.current = performance.now() + 2200;
    settle.current = setTimeout(() => publish({ ...current.current, phase: "idle" }), 450);
  };
  return <Context.Provider value={{ view, message: companionMessage(summary, view.focus, lang, view.variant), lang, cheer }}>
    <div ref={root} className={css.group} onPointerOverCapture={pointerOver} onPointerOutCapture={pointerOut}
      onClickCapture={click} onFocusCapture={focus}
      onPointerDownCapture={e => { if (e.pointerType !== "mouse") touch.current = { x: e.clientX, y: e.clientY }; }}
      onPointerCancelCapture={() => { touch.current = null; }}
      onPointerUpCapture={e => {
        const start = touch.current; touch.current = null;
        if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) return;
        const section = sectionOf(e.target);
        if (section && !(e.target as Element).closest("button,summary,a")) activate({ section }, true);
      }}>{children}</div>
  </Context.Provider>;
}

export function CompanionIntro({ section, title, caption, tag, children }: { section: CompanionSection; title: string; caption: string; tag?: string; children?: ReactNode }) {
  const companion = useContext(Context);
  const active = companion?.view.focus.section === section;
  return <div className={css.intro} data-current={active ? "true" : "false"} aria-live="off">
    <div><div className={css.heading}><h2>{title}</h2>{children}{tag && <span className={css.tag}>{tag}</span>}</div>
      <p id={"dashboard-companion-" + section} className={css.note} data-companion-message={active ? section : undefined}>{active ? companion.message : caption}</p>
    </div>
    <div className={css.spot}>{active && <button type="button" className={css.friend} data-companion-sprite={section} data-phase={companion.view.phase}
      aria-label={companion.lang === "jp" ? "もうひとこと応援してもらう" : "응원 한마디 더 듣기"} aria-describedby={"dashboard-companion-" + section} onClick={companion.cheer}>
      <span className={css.sprite} aria-hidden="true" /><span className={css.spark} aria-hidden="true">✦</span><span className={css.spark} aria-hidden="true">✧</span>
    </button>}</div>
  </div>;
}
export function CompanionWelcome({ title, caption }: { title: string; caption: string }) {
  return <div className={css.welcome}><CompanionIntro section="overview" title={title} caption={caption} /></div>;
}
