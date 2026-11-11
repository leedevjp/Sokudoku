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
    const { primary, secondary, readingHint } = correction.content;
    const hint = view.prefs.showReadingHints ? readingHint : null;
    // If the normal primary/secondary line is already the reading, replace
    // that line with the augmented reading rather than adding a duplicate.
    const plainReading = hint?.split(" [", 1)[0] ?? null;
    const normalize = (value: string) =>
      value.trim().replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
    const isReading = (value: string) =>
      !!plainReading && normalize(value) === plainReading;
    const primaryText = hint && isReading(primary) ? hint : primary;
    const secondaryText = secondary && hint && isReading(secondary) ? hint : secondary;
    measure.setFontSize(primarySize).setFontStyle("bold");
    const rows: CorrectionRow[] = measure
      .getWrappedText(primaryText)
      .map((text) => ({ text, secondary: false }));
    if (secondaryText) {
      measure.setFontSize(secondarySize).setFontStyle("normal");
      rows.push(
        ...measure.getWrappedText(secondaryText)
          .map((text) => ({ text, secondary: true })),
      );
    }
    if (hint && !isReading(primary) && !(secondary && isReading(secondary))) {
      measure.setFontSize(secondarySize).setFontStyle("normal");
      rows.push(...measure.getWrappedText(hint).map((text) => ({ text, secondary: true })));
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
