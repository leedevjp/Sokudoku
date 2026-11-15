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
  fullSnapshot = true,
): Promise<LearningSnapshot> {
  const complete = async (partial: LearningSnapshot) => {
    if (!fullSnapshot) return partial;
    const { data, error } = await client.rpc("learning_snapshot");
    if (error) throw Error("LEARNING_LOAD");
    return data as unknown as LearningSnapshot;
  };
  for (let attempt = 0; attempt < 5; attempt++) {
    // One SQL snapshot captures pending events and their starting cards.
    const { data: raw, error } = await client.rpc("learning_work");
    if (error) throw Error("LEARNING_LOAD");
    const { events: pending, ...snapshot } = raw as unknown as LearningSnapshot & { events: LearningEvent[] };
    let events = pending;
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
    if (!events.length) return complete(snapshot);
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
      return complete(engine.snapshot());
    }
  }
  throw Error("LEARNING_BUSY");
}
