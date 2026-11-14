import Phaser from "phaser";
import { gameAssetUrl } from "../asset-url";
import { prepareMedia } from "@/lib/sync/client";
import { effectFiles } from "./presentation-assets";

const MUSIC_GAIN = 0.5;
const EFFECTS_GAIN = 3;

type Cue = typeof effectFiles[number];

export class BattleAudio {
  enabled = false;
  musicVolume = .05;
  effectsVolume = .7;
  preview = false;
  private music?: HTMLAudioElement;
  private unlocked = false;
  private playing = false;
  private active = false;
  private duckUntil = 0;
  private generation = 0;
  private closed = false;
  private loading = false;
  private retryAt = 0;
  private musicUrl?: string;
  constructor(private scene: Phaser.Scene) {
    try {
      this.enabled = localStorage.getItem("sokudoku-battle-sound") === "on";
      const saved = JSON.parse(localStorage.getItem("sokudoku-audio-volumes") ?? "null");
      if (typeof saved?.music === "number" && Number.isFinite(saved.music)) this.musicVolume = Math.max(0, Math.min(1, saved.music));
      if (typeof saved?.effects === "number" && Number.isFinite(saved.effects)) this.effectsVolume = Math.max(0, Math.min(1, saved.effects));
    } catch {}
    scene.sound.volume = this.effectsVolume * EFFECTS_GAIN;
    window.addEventListener("keydown", this.unlock);
    window.addEventListener("pointerdown", this.unlock);
    const cleanup = () => {
      window.removeEventListener("keydown", this.unlock);
      window.removeEventListener("pointerdown", this.unlock);
      scene.sound.stopAll();
      this.generation++;
      this.closed = true;
      this.music?.pause();
      this.music?.removeAttribute("src");
      this.music?.load();
      if (this.musicUrl) URL.revokeObjectURL(this.musicUrl);
      scene.events.off("shutdown", cleanup);
      scene.events.off("destroy", cleanup);
    };
    scene.events.once("shutdown", cleanup);
    scene.events.once("destroy", cleanup);
  }
  private unlock = () => {
    this.unlocked = true;
    this.startMusic();
    const sound = this.scene.sound;
    if (sound instanceof Phaser.Sound.WebAudioSoundManager && sound.context.state === "suspended")
      void sound.context.resume().catch(() => {});
  };
  private startMusic() {
    if (!this.music || !this.active || !this.enabled || this.musicVolume <= 0 || !this.unlocked || this.playing || document.hidden) return;
    this.playing = true;
    const generation = this.generation;
    void this.music.play().catch(() => {
      if (generation === this.generation) { this.playing = false; this.unlocked = false; }
    });
  }
  update(active: boolean, delta: number) {
    active ||= this.preview;
    this.active = active;
    // One continuous study track for the whole run, including question/map changes.
    if (!this.music && !this.loading && !this.closed && performance.now() >= this.retryAt &&
        active && this.enabled && this.musicVolume > 0 && !document.hidden) void this.loadMusic();
    if (!active || !this.enabled || this.musicVolume <= 0 || document.hidden) {
      this.music?.pause(); this.playing = false; return;
    }
    this.startMusic();
    if (this.music) {
      const target = this.musicVolume * MUSIC_GAIN * (performance.now() < this.duckUntil ? .6 : 1);
      this.music.volume += (target - this.music.volume) * Math.min(1, delta / (target < this.music.volume ? 35 : 450));
    }
  }
  private async loadMusic() {
    this.loading = true;
    const generation = ++this.generation;
    try {
      const blob = await prepareMedia(gameAssetUrl("/audio/study-lobby-night-v1.mp3"), false);
      if (this.closed || generation !== this.generation) return;
      this.musicUrl = URL.createObjectURL(blob);
      this.music = new Audio(this.musicUrl);
      this.music.loop = true;
      this.music.volume = 0;
      this.playing = false;
      this.startMusic();
    } catch { this.retryAt = performance.now() + 15000; }
    finally { this.loading = false; }
  }
  impact(tier: number) {
    this.duckUntil = performance.now() + 160;
    this.play("hybrid", .28 + tier * .025);
    if (tier >= 2) this.play("jelly", .07);
  }
  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) this.stop();
    else this.unlock();
    try { localStorage.setItem("sokudoku-battle-sound", this.enabled ? "on" : "off"); } catch {}
  }
  setVolumes(music: number, effects: number) {
    this.musicVolume = Math.max(0, Math.min(1, music));
    this.effectsVolume = Math.max(0, Math.min(1, effects));
    this.scene.sound.volume = this.effectsVolume * EFFECTS_GAIN;
    if (this.music) this.music.volume = this.enabled ? this.musicVolume * MUSIC_GAIN : 0;
    // A user adjusting BGM during pause should hear the new level immediately.
    // Pausing at 0% also stops the media element, not just its audible output.
    this.update(this.active, 16);
    try { localStorage.setItem("sokudoku-audio-volumes", JSON.stringify({ music: this.musicVolume, effects: this.effectsVolume })); } catch {}
  }
  stop() { this.scene.sound.stopAll(); this.music?.pause(); this.playing = false; this.active = false; }
  play(cue: Cue, volume = cue === "dash" ? .12 : .20) {
    if (!this.enabled || document.hidden || !this.scene.cache.audio.exists("battle-" + cue)) return;
    const sound = this.scene.sound;
    if (sound instanceof Phaser.Sound.WebAudioSoundManager && sound.context.state !== "running") return;
    try { sound.play("battle-" + cue, { volume }); } catch {}
  }
}
