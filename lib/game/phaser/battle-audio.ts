import Phaser from "phaser";

const files = ["dash", "hybrid", "jelly", "hybrid-combo", "miss-combo"] as const;
type Cue = typeof files[number];
export function preloadBattleAudio(scene: Phaser.Scene) {
  for (const file of files) if (!scene.cache.audio.exists("battle-" + file))
    scene.load.audio("battle-" + file, "/audio/audition-v1/" + file + ".wav");
}

export class BattleAudio {
  enabled = true;
  private music?: HTMLAudioElement;
  private region = -1;
  private unlocked = false;
  private playing = false;
  private active = false;
  private duckUntil = 0;
  private generation = 0;
  constructor(private scene: Phaser.Scene) {
    try { this.enabled = localStorage.getItem("sokudoku-battle-sound") !== "off"; } catch {}
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
  update(region: number, active: boolean, delta: number) {
    this.active = active;
    if (this.region !== region) {
      this.music?.pause();
      this.generation++;
      this.music = new Audio(["/audio/meadow-bgm.mp3", "/audio/forest-bgm.mp3", "/audio/ruins-bgm.mp3"][region]);
      this.music.loop = true;
      this.music.volume = 0;
      this.region = region;
      this.playing = false;
    }
    if (!active || !this.enabled || document.hidden) {
      this.music?.pause(); this.playing = false; return;
    }
    this.startMusic();
    if (this.music) {
      const target = performance.now() < this.duckUntil ? .035 : .10;
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
    try { localStorage.setItem("sokudoku-battle-sound", this.enabled ? "on" : "off"); } catch {}
  }
  stop() { this.scene.sound.stopAll(); this.music?.pause(); this.playing = false; this.active = false; }
  play(cue: Cue, volume = cue === "dash" ? .12 : .20) {
    if (!this.enabled || document.hidden || !this.scene.cache.audio.exists("battle-" + cue)) return;
    const sound = this.scene.sound;
    if (sound instanceof Phaser.Sound.WebAudioSoundManager && sound.context.state !== "running") return;
    try { sound.play("battle-" + cue, { volume }); } catch {}
  }
}
