import Phaser from "phaser";
import { TrainingRun } from "./training-run";
import type { TrainingOptions } from "./types";

/** Phaser adapter: run logic and presentation own their respective lifecycles. */
export class TrainingScene extends Phaser.Scene {
  private training: TrainingRun;

  constructor(options: TrainingOptions, density: number) {
    super("Training");
    this.training = new TrainingRun(this, options, density);
  }

  setRenderDensity(value: number) {
    this.training.presentation.setRenderDensity(value);
  }

  create() {
    try {
      this.training.initialize();
      this.scale.on("resize", this.training.viewport.resize, this.training.viewport);
      this.events.once("shutdown", this.cleanup, this);
      this.events.once("destroy", this.cleanup, this);
      this.training.start();
      // The first quiz renders before presentation downloads or decoding begin.
      this.game.events.once("postrender", () => {
        if (this.sys.isActive()) this.training.presentation.startMedia();
      });
    } catch (error) {
      this.training.fail(error);
    }
  }

  update(_time: number, delta: number) {
    this.training.update(delta);
  }

  private cleanup() {
    this.training.close();
    this.events.off("shutdown", this.cleanup, this);
    this.events.off("destroy", this.cleanup, this);
  }
}
