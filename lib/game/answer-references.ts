type Reference = {
  source?: "word" | "personal";
  selected_source?: "word" | "personal";
  word_id: string;
  selected_word_id: string | null;
};

export function personalReferences(answers: Reference[]) {
  return [
    ...new Set(
      answers.flatMap((a) => [
        ...(a.source === "personal" ? [a.word_id] : []),
        ...(a.selected_source === "personal" && a.selected_word_id
          ? [a.selected_word_id]
          : []),
      ]),
    ),
  ];
}

// A deleted word may remain in another tab's game/offline queue. Such answers
// cannot satisfy the FK and are explicitly acknowledged as discarded, not saved.
export function partitionAnswers<T extends Reference>(
  answers: T[],
  available: Set<string>,
) {
  const accepted: T[] = [],
    discarded: T[] = [];
  for (const answer of answers) {
    (personalReferences([answer]).every((id) => available.has(id))
      ? accepted
      : discarded
    ).push(answer);
  }
  return { accepted, discarded };
}
