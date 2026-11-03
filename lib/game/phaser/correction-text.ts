import type { Correction } from "../correction";
import type { TrainingView } from "./board";

export type CorrectionRow = { text: string; secondary: boolean };

/** Fit ordinary meanings first; retain every line for scrolling unusually long text. */
export function correctionText(
  view: TrainingView,
  correction: Correction,
  width: number,
  height: number,
) {
  const s = view.boardLayout.scale;
  let primarySize = correction.content.secondary
    ? Math.max(20, 44 * s)
    : Math.max(28, 64 * s);
  const secondarySize = Math.max(15, 30 * s);
  const measure = view
    .designText(0, 0, "", primarySize, view.c.ink, true)
    .setWordWrapWidth(width, true)
    .setVisible(false);
  const wrap = () => {
    measure.setFontSize(primarySize).setFontStyle("bold");
    const rows: CorrectionRow[] = measure
      .getWrappedText(correction.content.primary)
      .map((text) => ({ text, secondary: false }));
    if (correction.content.secondary) {
      measure.setFontSize(secondarySize).setFontStyle("normal");
      rows.push(
        ...measure
          .getWrappedText(correction.content.secondary)
          .map((text) => ({ text, secondary: true })),
      );
    }
    return rows;
  };
  let rows = wrap();
  let lineHeight = Math.max(primarySize * 1.22, secondarySize * 1.3);
  let slots = Math.max(1, Math.floor(height / lineHeight));
  while (rows.length > slots && primarySize > 18) {
    primarySize = Math.max(18, primarySize - 1);
    rows = wrap();
    lineHeight = Math.max(primarySize * 1.22, secondarySize * 1.3);
    slots = Math.max(1, Math.floor(height / lineHeight));
  }
  measure.destroy();
  return { rows, primarySize, secondarySize, lineHeight, slots };
}
