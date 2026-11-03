import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { LearningEngine } from "./engine";
import {
  emptyLearning,
  LEARNING_VERSION,
  type LearningEvent,
  type LearningSnapshot,
} from "./types";

type Client = Awaited<ReturnType<typeof createClient>>;
const json = (value: unknown): Json =>
  JSON.parse(JSON.stringify(value)) as Json;
const compare = (a: LearningEvent, b: LearningEvent) =>
  Date.parse(a.answered_at) - Date.parse(b.answered_at) ||
  a.id.localeCompare(b.id);

/** Replay only new answers normally. Late/offline history or a model upgrade triggers a chronological rebuild. */
export async function synchronizeLearning(
  client: Client,
): Promise<LearningSnapshot> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const [{ data: raw, error }, { data: pendingRaw, error: historyError }] =
      await Promise.all([
        client.rpc("learning_snapshot"),
        client.rpc("learning_history", { pending_only: true }),
      ]);
    if (error || historyError) throw Error("LEARNING_LOAD");
    const snapshot = raw as unknown as LearningSnapshot;
    let events = pendingRaw as unknown as LearningEvent[];
    const learner = snapshot.learner;
    const late =
      learner?.last_answered_at &&
      events.some(
        (event) =>
          Date.parse(event.answered_at) <
            Date.parse(learner.last_answered_at!) ||
          (Date.parse(event.answered_at) ===
            Date.parse(learner.last_answered_at!) &&
            event.id.localeCompare(learner.last_answer_id!) < 0),
      );
    const rebuild =
      !learner || learner.model_version !== LEARNING_VERSION || late;
    if (rebuild) {
      const { data, error: fullError } = await client.rpc("learning_history", {
        pending_only: false,
      });
      if (fullError) throw Error("LEARNING_HISTORY");
      events = data as unknown as LearningEvent[];
    }
    if (!events.length) return snapshot;
    const engine = await LearningEngine.create(
      rebuild ? emptyLearning() : snapshot,
    );
    for (const event of events.sort(compare)) engine.apply(event);
    const { data: committed, error: saveError } = await client.rpc(
      "commit_learning",
      {
        expected_revision: learner?.revision ?? 0,
        learner: json(engine.learner),
        states: json([...engine.dirty.values()]),
        processed_ids: events.map((event) => event.id),
      },
    );
    if (saveError) throw Error("LEARNING_SAVE");
    if (committed) {
      engine.learner.revision = (learner?.revision ?? 0) + 1;
      return engine.snapshot();
    }
  }
  throw Error("LEARNING_BUSY");
}
