import Phaser from "phaser";

export type CorrectionActions = {
  advance: () => void;
  toggle: () => void;
  enabled: () => boolean;
};

type ScrollArea = {
  pauseX: number;
  pauseY: number;
  maxOffset: number;
  lineHeight: number;
  drawRows: (offset: number) => void;
};

/** Keep pause, tap and scroll gestures distinct; listeners live as long as the card. */
export function bindCorrectionInput(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  button: Phaser.GameObjects.Container,
  actions: CorrectionActions,
  area: ScrollArea,
) {
  let offset = 0;
  let drag: { id: number; y: number; offset: number; moved: boolean } | null =
    null;
  const cancel = () => {
    drag = null;
  };
  button.on(
    "pointerdown",
    (
      pointer: Phaser.Input.Pointer,
      _x: number,
      _y: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      cancel();
      if ((pointer.wasTouch || pointer.leftButtonDown()) && actions.enabled())
        actions.toggle();
    },
  );
  root.setInteractive({ useHandCursor: true });
  root.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    if (!actions.enabled() || (!pointer.wasTouch && !pointer.leftButtonDown()))
      return;
    // Reserve the pause target even if Phaser changes child/parent input ordering.
    if (
      Math.abs(pointer.worldX - root.x - area.pauseX) <= 22 &&
      Math.abs(pointer.worldY - root.y - area.pauseY) <= 22
    ) {
      cancel();
      actions.toggle();
      return;
    }
    if (!area.maxOffset) {
      actions.advance();
      return;
    }
    drag = { id: pointer.id, y: pointer.worldY, offset, moved: false };
  });
  const scrollTo = (value: number) => {
    offset = Phaser.Math.Clamp(value, 0, area.maxOffset);
    area.drawRows(offset);
  };
  const move = (pointer: Phaser.Input.Pointer) => {
    if (!drag || drag.id !== pointer.id || !actions.enabled()) return;
    const distance = drag.y - pointer.worldY;
    if (Math.abs(distance) > 8) drag.moved = true;
    scrollTo(drag.offset + Math.round(distance / area.lineHeight));
  };
  const up = (pointer: Phaser.Input.Pointer) => {
    if (!drag || drag.id !== pointer.id) return;
    const tap = !drag.moved;
    cancel();
    if (tap && actions.enabled()) actions.advance();
  };
  const wheel = (
    pointer: Phaser.Input.Pointer,
    _objects: Phaser.GameObjects.GameObject[],
    _dx: number,
    dy: number,
  ) => {
    if (
      !area.maxOffset ||
      !actions.enabled() ||
      !root.getBounds().contains(pointer.worldX, pointer.worldY)
    )
      return;
    scrollTo(offset + Math.sign(dy));
  };
  scene.input.on("pointermove", move);
  scene.input.on("pointerup", up);
  scene.input.on("wheel", wheel);
  scene.input.on("pointerupoutside", cancel);
  window.addEventListener("pointercancel", cancel);
  root.once("destroy", () => {
    scene.input.off("pointermove", move);
    scene.input.off("pointerup", up);
    scene.input.off("wheel", wheel);
    scene.input.off("pointerupoutside", cancel);
    window.removeEventListener("pointercancel", cancel);
  });
}
