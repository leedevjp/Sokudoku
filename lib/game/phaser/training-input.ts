import { keyIndex } from "../rules";
import type { Phase } from "./types";

type InputActions = {
  phase: () => Phase;
  press: (source: string, index: number) => void;
  correct: (index: number) => void;
  toggleCorrection: () => void;
  pause: () => void;
  resume: () => void;
  hidden: () => void;
  cancel: () => void;
};

/** Owns browser listeners and held-key suppression, independent of scene state. */
export class TrainingInput {
  private held = new Set<string>();
  constructor(private actions: InputActions) {}
  attach() {
    window.addEventListener("keydown", this.keyDown);
    window.addEventListener("keyup", this.keyUp);
    window.addEventListener("blur", this.actions.hidden);
    window.addEventListener("pointercancel", this.actions.cancel);
    document.addEventListener("visibilitychange", this.visibility);
  }
  detach() {
    window.removeEventListener("keydown", this.keyDown);
    window.removeEventListener("keyup", this.keyUp);
    window.removeEventListener("blur", this.actions.hidden);
    window.removeEventListener("pointercancel", this.actions.cancel);
    document.removeEventListener("visibilitychange", this.visibility);
    this.clear();
  }
  clear() {
    this.held.clear();
  }
  private keyDown = (event: KeyboardEvent) => {
    const index = keyIndex(event.code);
    if (index !== null) {
      event.preventDefault();
      if (event.repeat || this.held.has(event.code)) return;
      this.held.add(event.code);
      if (this.actions.phase() === "correction") this.actions.correct(index);
      else this.actions.press(event.code, index);
    } else if (
      event.code === "Space" &&
      this.actions.phase() === "correction"
    ) {
      event.preventDefault();
      if (event.repeat || this.held.has(event.code)) return;
      this.held.add(event.code);
      this.actions.toggleCorrection();
    } else if (event.code === "Escape") {
      event.preventDefault();
      if (this.actions.phase() === "paused") this.actions.resume();
      else this.actions.pause();
    }
  };
  private keyUp = (event: KeyboardEvent) => {
    if (keyIndex(event.code) === null && event.code !== "Space") return;
    event.preventDefault();
    this.held.delete(event.code);
  };
  private visibility = () => {
    if (document.hidden) this.actions.hidden();
  };
}
