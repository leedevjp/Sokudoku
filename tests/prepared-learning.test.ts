import test from "node:test";
import assert from "node:assert/strict";
import { LearningEngine } from "../lib/game/learning/engine";
import { cardKey } from "../lib/game/learning/types";
import { prepareLearning, restoreLearning } from "../lib/sync/prepared-learning";
import { applyPacket, emptySnapshot } from "../lib/sync/types";

test("learning replies transfer one changed card and preserve unchanged canonical references", async () => {
  const engine=await LearningEngine.create();
  for(const id of ["one","two"])engine.apply({id,word_id:id,source:"word",question_type:"meaning",result:"correct",difficulty:2,answered_at:"2026-11-14T00:00:00Z"});
  const snapshot=emptySnapshot("owner");snapshot.versions={learning_states:"1",learner:"1"};
  snapshot.data.learning_states=Object.fromEntries(engine.snapshot().words.map(w=>[cardKey(w.source,w.word_ref,w.question_type),w]));
  snapshot.data.learner.self={...engine.learner};
  const initial=prepareLearning(snapshot),cached=restoreLearning("owner",structuredClone(initial.reply))!;
  engine.apply({id:"new",word_id:"one",source:"word",question_type:"meaning",result:"incorrect",difficulty:2,answered_at:"2026-11-15T00:00:00Z"});
  const updated=applyPacket(snapshot,{owner:"owner",protocol:1,versions:{learning_states:"2",learner:"2"},changes:[
    {dataset:"learning_states",key:"word:one:meaning",version:"2",deleted:false,value:engine.words.get("word:one:meaning")!},
    {dataset:"learner",key:"self",version:"2",deleted:false,value:{...engine.learner}},
  ]});
  const next=prepareLearning(updated,cached.key,initial.cache);
  assert.deepEqual(next.reply.learning!.words,[]);assert.equal(next.reply.learningDelta!.words.length,1);
  const restored=restoreLearning("owner",structuredClone(next.reply),cached)!;
  assert.equal(restored.rows.get("word:two:meaning"),cached.rows.get("word:two:meaning"));
  assert.equal(restored.rows.get("word:one:meaning")!.last_answer_id,"new");
  assert.equal(cached.rows.get("word:one:meaning")!.last_answer_id,"one");
  const unchanged=prepareLearning(updated,restored.key,next.cache);
  const reused=restoreLearning("owner",unchanged.reply,restored)!;
  assert.equal(reused.rows,restored.rows);assert.equal(reused.learning.words,restored.learning.words);
  assert.throws(()=>restoreLearning("other",next.reply,cached),/LEARNING_CACHE_MISS/);
  assert.throws(()=>restoreLearning("owner",next.reply),/LEARNING_CACHE_MISS/);
  assert.equal(prepareLearning(updated,"stale",next.cache).reply.learningDelta,undefined);
  const deleted=applyPacket(updated,{owner:"owner",protocol:1,versions:{learning_states:"3",learner:"2"},changes:[
    {dataset:"learning_states",key:"word:two:meaning",version:"3",deleted:true,value:null},
  ]});
  const removal=prepareLearning(deleted,restored.key,next.cache);
  assert.deepEqual(removal.reply.learningDelta!.removed,["word:two:meaning"]);
  assert.equal(restoreLearning("owner",removal.reply,restored)!.rows.size,1);
  const reordered={...updated,versions:{...updated.versions,learning_states:"4"},data:{...updated.data,
    learning_states:Object.fromEntries(Object.entries(updated.data.learning_states).reverse())}};
  assert.equal(prepareLearning(reordered,restored.key,next.cache).reply.learningDelta,undefined,"order changes require a full reset");
});

test("shared canonical rows are not mutated by FSRS or learner updates", async () => {
  const source=await LearningEngine.create();source.apply({id:"old",word_id:"one",source:"word",question_type:"meaning",result:"correct",difficulty:2,answered_at:"2026-11-14T00:00:00Z"});
  const snapshot=source.snapshot(),original=JSON.stringify(snapshot);
  Object.freeze(snapshot.words[0].card);Object.freeze(snapshot.words[0]);Object.freeze(snapshot.learner);
  const engine=await LearningEngine.create(snapshot,{shareWords:true,cooperative:true});
  assert.equal(engine.words.get("word:one:meaning"),snapshot.words[0]);
  engine.apply({id:"new",word_id:"one",source:"word",question_type:"meaning",result:"incorrect",difficulty:2,answered_at:"2026-11-15T00:00:00Z"});
  assert.notEqual(engine.words.get("word:one:meaning"),snapshot.words[0]);assert.equal(JSON.stringify(snapshot),original);
});
