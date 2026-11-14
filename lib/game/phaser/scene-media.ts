import type Phaser from "phaser";
import { prepareMedia } from "@/lib/sync/client";
import { gameAssetUrl } from "../asset-url";
import { battleImages, laterImages, effectFiles } from "./presentation-assets";

/** Never awaited by the question path. Network work belongs to the root worker. */
export class SceneMedia {
  private closed = false;
  private flight?: Promise<void>;
  private retry?: ReturnType<typeof setTimeout>;
  private urls = new Set<string>();
  private cancellations = new Set<() => void>();
  private uploads = Promise.resolve();
  constructor(private scene: Phaser.Scene) {}
  private async image(key: string, source: string, priority = true) {
    if (this.scene.textures.exists(key)) return;
    const blob = await prepareMedia(gameAssetUrl(source), priority);
    if (this.closed) return;
    const url = URL.createObjectURL(blob);
    this.urls.add(url);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      // Spread texture uploads over frames; never redraw the current question.
      const upload = this.uploads.then(async () => {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        if (!this.closed && !this.scene.textures.exists(key)) this.scene.textures.addImage(key, image);
      });
      this.uploads = upload.catch(() => {});
      await upload;
    } finally { URL.revokeObjectURL(url); this.urls.delete(url); }
  }
  private async audio(file: string) {
    const key = "battle-" + file;
    if (this.scene.cache.audio.exists(key)) return;
    const blob = await prepareMedia(gameAssetUrl(`/audio/audition-v1/${file}.wav`), false);
    if (this.closed) return;
    const url = URL.createObjectURL(blob);
    this.urls.add(url);
    // Phaser selects WebAudio decoding or its HTML audio fallback.
    await new Promise<void>((resolve, reject) => {
      const complete = (loaded: string) => { if (loaded === key) { clean(); resolve(); } };
      const failed = (entry: { key: string }) => { if (entry.key === key) { clean(); reject(Error("AUDIO_DECODE")); } };
      const clean = () => {
        this.scene.load.off("filecomplete", complete); this.scene.load.off("loaderror", failed);
        this.cancellations.delete(cancel);
      };
      const cancel = () => { clean(); resolve(); };
      this.cancellations.add(cancel);
      this.scene.load.on("filecomplete", complete); this.scene.load.on("loaderror", failed);
      this.scene.load.audio(key, { url, type: "wav" });
      this.scene.load.start();
    });
  }
  start() {
    if (this.closed || this.flight) return;
    clearTimeout(this.retry);
    this.flight = Promise.allSettled([
      ...battleImages.map(([key, source]) => this.image(key, source)),
      ...laterImages.map(([key, source]) => this.image(key, source, false)),
      ...effectFiles.map(file => this.audio(file)),
    ]).then(results => {
      if (!this.closed && results.some(result => result.status === "rejected"))
        this.retry = setTimeout(() => this.start(), 15000);
    }).finally(() => { this.flight = undefined; });
  }
  close() {
    this.closed = true;
    clearTimeout(this.retry);
    for (const cancel of this.cancellations) cancel();
    for (const url of this.urls) URL.revokeObjectURL(url);
    this.urls.clear();
  }
}
