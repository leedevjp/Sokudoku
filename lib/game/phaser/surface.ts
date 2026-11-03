import Phaser from "phaser";
import { palette, translate, type Preferences } from "../preferences";

/** Canvas coordinates and drawing primitives shared by the board and overlays. */
export class TrainingSurface {
  constructor(
    protected scene: Phaser.Scene,
    private getDensity: () => number,
    private getPreferences: () => Preferences,
  ) {}
  get add() {
    return this.scene.add;
  }
  get game() {
    return this.scene.game;
  }
  private get density() {
    return this.getDensity();
  }
  get prefs() {
    return this.getPreferences();
  }
  get c() {
    return palette[this.prefs.theme];
  }
  get w() {
    return this.scene.scale.width / this.density;
  }
  get h() {
    return this.scene.scale.height / this.density;
  }
  get cw() {
    return this.boardLayout.width;
  }
  get boardLayout() {
    const scale = Math.max(
      0.25,
      Math.min((this.w - 48) / 632, (this.h - 26) / 1024, 1),
    );
    const width = 632 * scale;
    const top = Math.max(14, Math.min(38 * scale, (this.h - 1024 * scale) / 2));
    const extra = Math.max(0, this.h - (top + 1024 * scale)) * 0.45;
    return { scale, width, left: (this.w - width) / 2, top, extra };
  }
  get factor() {
    return Math.min(1.15, this.cw / 440);
  }
  t(jp: string, kr: string) {
    return translate(this.prefs.lang, jp, kr);
  }
  hex(n: number) {
    return "#" + n.toString(16).padStart(6, "0");
  }
  text(x: number, y: number, value: string, size: number, color = this.c.ink) {
    return this.add
      .text(x, y, value, {
        fontFamily: getComputedStyle(document.body).fontFamily,
        fontSize: Math.round(size * this.factor),
        color: this.hex(color),
        align: "center",
        lineSpacing: 6,
      })
      .setResolution(Math.min(4, Math.max(2, this.density * 1.5)))
      .setOrigin(0.5);
  }
  box(
    x: number,
    y: number,
    width: number,
    height: number,
    color = this.c.panel,
    r = 20,
  ) {
    const g = this.add.graphics();
    const depth = Math.max(3, 6 * this.boardLayout.scale);
    g.fillStyle(this.c.shade).fillRoundedRect(
      x - width / 2,
      y - height / 2 + depth,
      width,
      height,
      r,
    );
    g.fillStyle(color).fillRoundedRect(
      x - width / 2,
      y - height / 2,
      width,
      height,
      r,
    );
    g.lineStyle(
      Math.max(1, 2 * this.boardLayout.scale),
      color === this.c.blue ? this.c.blueDark : this.c.line,
    ).strokeRoundedRect(x - width / 2, y - height / 2, width, height, r);
    return g;
  }
  designText(
    x: number,
    y: number,
    label: string,
    size: number,
    color = this.c.ink,
    bold = false,
  ) {
    const text = this.text(x, y, label, size / this.factor, color);
    if (bold) text.setFontStyle("bold");
    return text;
  }
  backdrop() {
    const g = this.add.graphics();
    const dark = this.prefs.theme === "dark";
    const radius = Math.max(this.w * 0.65, 380);
    for (let i = 28; i >= 1; i--) {
      g.fillStyle(this.c.blue, dark ? 0.007 : 0.004).fillCircle(
        this.w * 0.9,
        this.h * 0.03,
        (radius * i) / 28,
      );
      g.fillStyle(this.c.sky, dark ? 0.004 : 0.005).fillCircle(
        this.w * 0.04,
        this.h * 0.97,
        (radius * i) / 28,
      );
    }
    const step = Math.max(18, 32 * this.boardLayout.scale);
    g.fillStyle(this.c.dot, dark ? 0.12 : 0.1);
    for (let x = step / 2; x < this.w; x += step)
      for (let y = step / 2; y < this.h; y += step)
        g.fillCircle(x, y, Math.max(0.8, 1.5 * this.boardLayout.scale));
  }
  spark(x: number, y: number, r: number, alpha: number) {
    const g = this.add.graphics().fillStyle(this.c.blue, alpha);
    g.fillPoints(
      [
        { x, y: y - r },
        { x: x + r * 0.25, y: y - r * 0.25 },
        { x: x + r, y },
        { x: x + r * 0.25, y: y + r * 0.25 },
        { x, y: y + r },
        { x: x - r * 0.25, y: y + r * 0.25 },
        { x: x - r, y },
        { x: x - r * 0.25, y: y - r * 0.25 },
      ].map((p) => new Phaser.Math.Vector2(p.x, p.y)),
      true,
    );
    return g;
  }
  button(
    label: string,
    x: number,
    y: number,
    width: number,
    action: () => void,
    primary = false,
    parent?: Phaser.GameObjects.Container,
    disabled = false,
  ) {
    const b = this.add.container(x, y);
    b.add(
      this.box(
        0,
        0,
        width,
        46,
        disabled ? this.c.disabledBg : primary ? this.c.blue : this.c.panel,
        13,
      ),
    );
    b.add(
      this.designText(
        0,
        0,
        label,
        Math.max(14, 16 * this.factor),
        disabled ? this.c.disabledInk : primary ? this.c.onBrand : this.c.ink,
        true,
      ),
    );
    b.setSize(width, 46);
    if (!disabled) {
      b.setInteractive({ useHandCursor: true });
      b.on("pointerup", action);
    }
    if (parent) parent.add(b);
    return b;
  }
}
