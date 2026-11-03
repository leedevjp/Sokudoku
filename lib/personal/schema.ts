import { z } from "zod";
export const PAGE_SIZE = 20;
export const toHiragana = (value: string) =>
  value.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
export const personalWordInput = z
  .object({
    term: z.string().trim().min(1).max(100),
    kana: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/^[ぁ-ゖァ-ヶー〜～・\s]+$/u)
      .transform(toHiragana),
    meaning_ko: z.string().trim().min(1).max(1000),
    hanja_reading: z
      .string()
      .trim()
      .max(100)
      .nullable()
      .transform((v) => v || null),
    difficulty: z.number().int().min(0).max(10),
    note: z
      .string()
      .trim()
      .max(4000)
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
  q: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
export type PersonalWordInput = z.output<typeof personalWordInput>;
export function wordChanges(input: PersonalWordInput) {
  return { ...input, has_kanji: /\p{Script=Han}/u.test(input.term) };
}
