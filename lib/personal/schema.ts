import { z } from "zod";
export const PAGE_SIZE = 20;
// Content is always plain text. These rules are for vocabulary quality and
// invisible-character abuse, not a substitute for bound database parameters.
const normalized = (max: number, multiline = false) =>
  z
    .string()
    .max(max * 2)
    .refine(
      (value) =>
        !/[\p{C}]/u.test(multiline ? value.replace(/[\r\n\t]/g, "") : value),
    )
    .transform((value) =>
      value.normalize("NFKC").replace(/\r\n?/g, "\n").trim(),
    )
    .pipe(z.string().max(max));
const term = normalized(100).pipe(
  z
    .string()
    .min(1)
    .regex(/^[\p{L}\p{M}\p{N} ・ー々〆ヶ〜~+/#&%._()\-]+$/u)
    .refine((value) => /[\p{L}\p{N}]/u.test(value)),
);
const prose = (max: number, multiline = false) =>
  normalized(max, multiline).pipe(
    z
      .string()
      .regex(
        multiline
          ? /^[\p{L}\p{M}\p{N} \n\t.,!?：:、。・·〜~ー々〆ヶ「」『』（）()\[\]＋+/#&%=_@'"\-]*$/u
          : /^[\p{L}\p{M}\p{N} .,!?：:、。・·〜~ー々〆ヶ「」『』（）()\[\]＋+/#&%=_@'"\-]*$/u,
      ),
  );
export const toHiragana = (value: string) =>
  value.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
export const personalWordInput = z
  .object({
    term,
    kana: normalized(200)
      .pipe(
        z
          .string()
          .min(1)
          .regex(/^[ぁ-ゖァ-ヶー〜~・ ]+$/u)
          .refine((value) => /[ぁ-ゖァ-ヶ]/u.test(value)),
      )
      .transform(toHiragana),
    meaning_ko: prose(1000).refine((value) => /[\p{L}\p{N}]/u.test(value)),
    hanja_reading: normalized(100)
      .pipe(z.string().regex(/^[가-힣 ・·]*$/u))
      .nullable()
      .transform((v) => v || null),
    difficulty: z.number().int().min(0).max(10),
    note: prose(4000, true)
      .nullable()
      .transform((v) => v || null),
  })
  .strict();
export const revisionInput = z
  .object({ updated_at: z.iso.datetime({ offset: true }) })
  .strict();
export const personalWordUpdate = personalWordInput.extend({
  updated_at: z.iso.datetime({ offset: true }),
});
export const listInput = z.object({
  q: normalized(100).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
export type PersonalWordInput = z.output<typeof personalWordInput>;
export function wordChanges(input: PersonalWordInput) {
  return { ...input, has_kanji: /\p{Script=Han}/u.test(input.term) };
}
