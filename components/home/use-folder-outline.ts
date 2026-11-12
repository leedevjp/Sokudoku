"use client";
import { useLayoutEffect, useRef, useState } from "react";
import type { TrainingMode } from "@/lib/game/learning/types";
import { makeFolderOutline } from "./folder-outline-path";

/** Track real tab/body geometry, including orientation and responsive changes.
 *  Rendering remains a single SVG path, never overlapping CSS borders. */
export function useFolderOutline(modes: TrainingMode[], lang: string) {
  const folderRef = useRef<HTMLElement>(null);
  const [folderOutline, setFolderOutline] = useState<{ width: number; height: number; d: string } | null>(null);
  useLayoutEffect(() => {
    const folder = folderRef.current;
    const tabs = folder?.querySelector<HTMLElement>(".training-modes");
    const body = folder?.querySelector<HTMLElement>(".home-folder-body");
    if (!folder || !tabs || !body) return;

    let animationFrame = 0;
    const updateOutline = () => {
      const origin = folder.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      const gridRect = tabs.getBoundingClientRect();
      if (origin.width <= 4 || bodyRect.height <= 4) return;

      // Read the *real* four-column button geometry, including their inset
      // margins. There is one tab silhouette even for Explore + Review.
      const activeButtons = Array.from(
        tabs.querySelectorAll<HTMLButtonElement>('button[aria-pressed="true"]'),
      );
      const first = activeButtons[0];
      const last = activeButtons[activeButtons.length - 1];
      const firstRect = first?.getBoundingClientRect();
      const lastRect = last?.getBoundingClientRect();
      const firstMargin = first ? Number.parseFloat(getComputedStyle(first).marginLeft) || 0 : 0;
      const lastMargin = last ? Number.parseFloat(getComputedStyle(last).marginRight) || 0 : 0;
      const width = origin.width;
      const height = origin.height;
      const d = makeFolderOutline({
        width,
        height,
        bodyTop: bodyRect.top - origin.top,
        tab: firstRect && lastRect
          ? {
              left: firstRect.left - origin.left - firstMargin,
              right: lastRect.right - origin.left + lastMargin,
              top: gridRect.top - origin.top,
            }
          : undefined,
      });
      if (!d) return;
      const next = { width, height, d };
      setFolderOutline((previous) =>
        previous?.width === width && previous?.height === height && previous?.d === d
          ? previous
          : next,
      );
    };
    const scheduleOutline = () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        animationFrame = 0;
        updateOutline();
      });
    };
    const resizeObserver = new ResizeObserver(scheduleOutline);
    for (const element of [folder, body, tabs, ...tabs.querySelectorAll("button")]) {
      resizeObserver.observe(element);
    }
    window.addEventListener("resize", scheduleOutline);
    // Calculate before paint, not after the user notices a misaligned seam.
    updateOutline();
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleOutline);
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [modes, lang]);


  return { folderRef, folderOutline };
}
