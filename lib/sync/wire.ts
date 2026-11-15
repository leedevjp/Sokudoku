import type { SyncPacket } from "./types";

export type SyncPage = SyncPacket & { done: boolean; after: [string, string] | null };
export type CompactSyncPage = Omit<SyncPage, "changes"> & {
  content_schema: 1;
  changes: (Omit<SyncPacket["changes"][number], "value"> & {
    value: SyncPacket["changes"][number]["value"] | [string, "word" | "extra", string];
  })[];
};

/** Content payloads change independently of sync cursors and row ordering. */
export function decodeSyncPage(page: SyncPage | CompactSyncPage): SyncPage {
  if (!("content_schema" in page)) return page;
  if (page.content_schema !== 1) throw Error("INVALID_CONTENT_SCHEMA");
  return { ...page, changes: page.changes.map(change => {
    if (change.dataset !== "distractors" || change.deleted)
      return { ...change, value: change.value as SyncPacket["changes"][number]["value"] };
    const row = change.value;
    if (!Array.isArray(row) || row.length !== 3 || typeof row[0] !== "string" ||
      !["word", "extra"].includes(row[1]) || typeof row[2] !== "string") throw Error("INVALID_DISTRACTOR");
    return { ...change, value: { target_word_id: row[0], candidate_source: row[1], candidate_id: row[2],
      question_type: "meaning", status: "approved" } };
  }) };
}
