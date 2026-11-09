import { z } from "zod";

export const answerSchema = z
  .object({
    id: z.uuid(),
    source: z.enum(["word", "personal"]).optional(),
    selected_source: z.enum(["word", "personal", "extra"]).optional(),
    word_id: z.uuid(),
    question_type: z.enum(["meaning", "reading"]),
    mode: z.enum(["exploration", "review", "exam"]).optional(),
    selected_word_id: z.uuid().nullable(),
    result: z.enum(["correct", "incorrect", "timeout"]),
    response_ms: z.number().int().min(0).max(10000).nullable(),
    time_limit_ms: z.number().int().min(2000).max(10000).nullable(),
    answered_at: z.iso.datetime({ offset: true }),
  })
  .strict()
  .refine((a) => a.selected_source !== "extra" ||
    (a.question_type === "meaning" && a.result === "incorrect" && a.source !== "personal"))
  .refine((a) =>
    a.time_limit_ms === null
      ? a.response_ms === null && a.result !== "timeout" && a.selected_word_id !== null && (a.result === "correct" ? a.selected_word_id === a.word_id : a.selected_word_id !== a.word_id)
      : a.response_ms !== null && (a.result === "timeout"
      ? a.selected_word_id === null && a.response_ms === a.time_limit_ms
      : a.selected_word_id !== null &&
        a.response_ms < a.time_limit_ms &&
        (a.result === "correct"
          ? a.selected_word_id === a.word_id
          : a.selected_word_id !== a.word_id)),
  );
