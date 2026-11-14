"use client";
import { useEffect, type RefObject } from "react";
import type { TrainingMode } from "@/lib/game/learning/types";
import type { TrainingLevel } from "@/lib/game/selection";
import type { Kind } from "@/lib/game/types";

/** Clips the shared shimmer to the selected home controls without touching selection state. */
export function useHomeSheen(
  homeActionsRef: RefObject<HTMLDivElement | null>,
  sheenRef: RefObject<HTMLDivElement | null>,
  modes: TrainingMode[],
  levels: TrainingLevel[],
  kinds: Kind[],
  loading: boolean,
  owner: string | undefined,
) {
  useEffect(() => {
    const home = homeActionsRef.current;
    const sheen = sheenRef.current;
    if (!home || !sheen) return;

    // All selected buttons reveal the same animated light beam. Their rounded
    // rectangles form one clip-path in home-relative coordinates, so the beam
    // moves across the whole UI at precisely the same speed and phase.
    const round = (value: number) => Math.round(value * 10) / 10;
    const updateSheenMask = () => {
      const area = home.getBoundingClientRect();
      home.style.setProperty("--home-sheen-stage-width", `${round(area.width)}px`);
      const selected = home.querySelectorAll<HTMLElement>(
        '.training-levels button[aria-pressed="true"], .home-launch-group .primary:not(:disabled):not([aria-disabled="true"])',
      );
      const selectedButtons = Array.from(selected);
      const joinedTabs = selectedButtons.filter((button) =>
        button.closest(".training-modes.tab-manual-both"),
      );
      const rectangles = selectedButtons.flatMap((button) => {
        if (joinedTabs.length === 2 && button === joinedTabs[1]) return [];
        if (joinedTabs.length === 2 && button === joinedTabs[0]) {
          const first = joinedTabs[0].getBoundingClientRect();
          const second = joinedTabs[1].getBoundingClientRect();
          return [{
            left: first.left,
            top: Math.min(first.top, second.top),
            width: second.right - first.left,
            height: Math.max(first.bottom, second.bottom) - Math.min(first.top, second.top),
          }];
        }
        return [button.getBoundingClientRect()];
      });
      const paths = rectangles.map((rect) => {
        const x = round(rect.left - area.left);
        const y = round(rect.top - area.top);
        const w = round(rect.width);
        const h = round(rect.height);
        const r = round(Math.min(13, w / 2, h / 2));
        return [
          `M ${round(x + r)} ${y}`,
          `H ${round(x + w - r)}`,
          `Q ${round(x + w)} ${y} ${round(x + w)} ${round(y + r)}`,
          `V ${round(y + h - r)}`,
          `Q ${round(x + w)} ${round(y + h)} ${round(x + w - r)} ${round(y + h)}`,
          `H ${round(x + r)}`,
          `Q ${x} ${round(y + h)} ${x} ${round(y + h - r)}`,
          `V ${round(y + r)}`,
          `Q ${x} ${y} ${round(x + r)} ${y} Z`,
        ].join(" ");
      });
      sheen.style.clipPath = paths.length ? `path("${paths.join(" ")}")` : "inset(100%)";
    };

    const observer = new ResizeObserver(updateSheenMask);
    observer.observe(home);
    for (const button of home.querySelectorAll<HTMLElement>(
      ".training-levels button, .home-launch-group .primary",
    )) observer.observe(button);
    window.addEventListener("resize", updateSheenMask);
    updateSheenMask();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSheenMask);
    };
  }, [homeActionsRef, sheenRef, modes, levels, kinds, loading, owner]);


}
