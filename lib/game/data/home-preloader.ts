import type { Kind } from "../types";
import type { TrainingMode } from "../learning/types";
import { TrainingRuntime, type TrainingData } from "./training-runtime";

export type HomeTrainingSelection = {
  owner: string;
  levels: string;
  kinds: Kind[];
  modes: TrainingMode[];
};

export const homeTrainingKey = (selection: HomeTrainingSelection) =>
  JSON.stringify([selection.owner, selection.levels, selection.kinds, selection.modes]);

type PreloadedGame = {
  key: string;
  runtime: TrainingRuntime;
  data: Promise<TrainingData>;
};

/** Prepare the *actual* first quiz while the user is on the home screen.
 * Only the matching owner/selection may consume it. No additional API call or
 * answer generation is required when navigating to /game. */
export class HomeTrainingPreloader {
  private entry?: PreloadedGame;

  warm(selection: HomeTrainingSelection) {
    const key = homeTrainingKey(selection);
    if (this.entry?.key === key) return;
    this.clear();
    const runtime = new TrainingRuntime({
      levels: selection.levels,
      kinds: [...selection.kinds],
      modes: [...selection.modes],
      expectedOwner: selection.owner,
      onLoginRequired: () => {},
    });
    const entry: PreloadedGame = { key, runtime, data: runtime.load() };
    this.entry = entry;
    // Failed preloads never block the normal game-loading path.
    void entry.data.catch(() => {
      if (this.entry !== entry) return;
      this.entry = undefined;
      runtime.dispose();
    });
  }

  take(selection: HomeTrainingSelection): PreloadedGame | null {
    const entry = this.entry;
    if (!entry || entry.key !== homeTrainingKey(selection)) return null;
    this.entry = undefined; // Ownership moves to GameHost.
    return entry;
  }

  clear() {
    const entry = this.entry;
    this.entry = undefined;
    entry?.runtime.dispose();
  }
}

export const homeTrainingPreloader = new HomeTrainingPreloader();
