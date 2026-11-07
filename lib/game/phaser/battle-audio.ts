import Phaser from "phaser";

const files = ["dash", "hybrid", "jelly", "hybrid-combo", "miss-combo"] as const;
type Cue = typeof files[number];
export function preloadBattleAudio(scene: Phaser.Scene) {
  for (const file of files) if (!scene.cache.audio.exists("battle-" + file))
    scene.load.audio("battle-" + file, "/audio/audition-v1/" + file + ".wav");
}

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
  constructor(private scene: Phaser.Scene) {
    try {
      this.enabled = localStorage.getItem("sokudoku-battle-sound") === "on";
      const saved = JSON.parse(localStorage.getItem("sokudoku-audio-volumes") ?? "null");
      if (typeof saved?.music === "number" && Number.isFinite(saved.music)) this.musicVolume = Math.max(0, Math.min(1, saved.music));
      if (typeof saved?.effects === "number" && Number.isFinite(saved.effects)) this.effectsVolume = Math.max(0, Math.min(1, saved.effects));
    } catch {}
    scene.sound.volume = this.effectsVolume;
    window.addEventListener("keydown", this.unlock);
    window.addEventListener("pointerdown", this.unlock);
    const cleanup = () => {
      window.removeEventListener("keydown", this.unlock);
      window.removeEventListener("pointerdown", this.unlock);
      scene.sound.stopAll();
      this.generation++;
      this.music?.pause();
      this.music?.removeAttribute("src");
      this.music?.load();
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
    if (!this.music || !this.active || !this.enabled || !this.unlocked || this.playing || document.hidden) return;
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
    if (!this.music) {
      this.generation++;
      this.music = new Audio("/audio/study-lobby-night-v1.mp3");
      this.music.loop = true;
      this.music.volume = 0;
      this.playing = false;
    }
    if (!active || !this.enabled || document.hidden) {
      this.music?.pause(); this.playing = false; return;
    }
    this.startMusic();
    if (this.music) {
      const target = this.musicVolume * (performance.now() < this.duckUntil ? .6 : 1);
      this.music.volume += (target - this.music.volume) * Math.min(1, delta / (target < this.music.volume ? 35 : 450));
    }
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
    this.scene.sound.volume = this.effectsVolume;
    if (this.music) this.music.volume = this.musicVolume;
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
