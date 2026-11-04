import { z } from "zod";

export const answerSchema = z
  .object({
    id: z.uuid(),
    source: z.enum(["word", "personal"]).optional(),
    selected_source: z.enum(["word", "personal"]).optional(),
    word_id: z.uuid(),
    question_type: z.enum(["meaning", "reading"]),
    mode: z.enum(["exploration", "review", "exam"]).optional(),
    selected_word_id: z.uuid().nullable(),
    result: z.enum(["correct", "incorrect", "timeout"]),
    response_ms: z.number().int().min(0).max(10000),
    time_limit_ms: z.number().int().min(2000).max(10000),
    answered_at: z.iso.datetime({ offset: true }),
  })
  .strict()
  .refine((a) =>
    a.result === "timeout"
      ? a.selected_word_id === null && a.response_ms === a.time_limit_ms
      : a.selected_word_id !== null &&
        a.response_ms < a.time_limit_ms &&
        (a.result === "correct"
          ? a.selected_word_id === a.word_id
          : a.selected_word_id !== a.word_id),
  );
