import Phaser from "phaser";

const files = ["dash", "hybrid", "jelly", "hybrid-combo", "miss-combo"] as const;
type Cue = typeof files[number];
export function preloadBattleAudio(scene: Phaser.Scene) {
  for (const file of files) if (!scene.cache.audio.exists("battle-" + file))
    scene.load.audio("battle-" + file, "/audio/audition-v1/" + file + ".wav");
}

export class BattleAudio {
  enabled = true;
  constructor(private scene: Phaser.Scene) {
    try { this.enabled = localStorage.getItem("sokudoku-battle-sound") !== "off"; } catch {}
    window.addEventListener("keydown", this.unlock);
    window.addEventListener("pointerdown", this.unlock);
    const cleanup = () => {
      window.removeEventListener("keydown", this.unlock);
      window.removeEventListener("pointerdown", this.unlock);
      scene.sound.stopAll();
      scene.events.off("shutdown", cleanup);
      scene.events.off("destroy", cleanup);
    };
    scene.events.once("shutdown", cleanup);
    scene.events.once("destroy", cleanup);
  }
  private unlock = () => {
    const sound = this.scene.sound;
    if (sound instanceof Phaser.Sound.WebAudioSoundManager && sound.context.state === "suspended")
      void sound.context.resume().catch(() => {});
  };
  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) this.stop();
    try { localStorage.setItem("sokudoku-battle-sound", this.enabled ? "on" : "off"); } catch {}
  }
  stop() { this.scene.sound.stopAll(); }
  play(cue: Cue) {
    if (!this.enabled || document.hidden || !this.scene.cache.audio.exists("battle-" + cue)) return;
    const sound = this.scene.sound;
    if (sound instanceof Phaser.Sound.WebAudioSoundManager && sound.context.state !== "running") return;
    try { sound.play("battle-" + cue, { volume: cue === "dash" ? .16 : .28 }); } catch {}
  }
}
