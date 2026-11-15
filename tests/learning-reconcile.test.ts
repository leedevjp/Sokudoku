import test from "node:test";
import assert from "node:assert/strict";
import { LearningEngine } from "../lib/game/learning/engine";
import { equivalentLearningDelta, recoverLiveLearning } from "../lib/game/learning/reconcile";
import { cardKey, wordKey } from "../lib/game/learning/types";
import { WorkBudget } from "../lib/game/learning/work-budget";
import type { Word, Answer } from "../lib/game/types";

const word:Word={id:"one",term:"語",kana:"ご",meaning_ko:"뜻",hanja_reading:null,difficulty:2,has_kanji:true,deleted_at:null};
const answer:Answer={id:"new",word_id:"one",source:"word",question_type:"meaning",selected_word_id:"one",result:"correct",response_ms:200,time_limit_ms:10000,answered_at:"2026-11-15T00:00:00Z"};
test("equivalent ACK compares only affected cards; real changes and stale bases are retained",async t=>{
  const canonical=await LearningEngine.create();
  for(let i=0;i<1000;i++)canonical.apply({id:"old"+i,word_id:i?String(i):"one",source:"word",question_type:"meaning",result:"correct",difficulty:2,answered_at:"2026-11-14T00:00:00Z"});
  const previous={user_id:"owner",words:[word],stats:[],learning:canonical.snapshot(),learningKey:"base"};
  const active=await LearningEngine.create(previous.learning);active.apply({...answer,source:"word",difficulty:2});canonical.apply({...answer,source:"word",difficulty:2});
  const changed=canonical.words.get("word:one:meaning")!;
  const fresh={...previous,learning:canonical.snapshot(),learningKey:"next",learningIndex:new Map(canonical.words),
    learningDelta:{baseKey:"base",words:[changed],removed:[]}};
  const catalog=new Map([[wordKey(word.source,word.id),word]]);
  const original=LearningEngine.create,loaded:number[]=[];
  t.mock.method(LearningEngine,"create",async(...args:Parameters<typeof original>)=>{loaded.push(args[0]?.words.length??0);return original(...args)});
  assert.equal(await equivalentLearningDelta(active,previous,fresh,[],[answer],catalog),true);
  assert.deepEqual(loaded,[1],"ACK must not reconstruct all 1000 cards");
  assert.equal(await equivalentLearningDelta(active,previous,{...fresh,learningDelta:{...fresh.learningDelta,baseKey:"stale"}},[],[answer],catalog),false);
  canonical.apply({id:"remote",word_id:"one",source:"word",question_type:"meaning",result:"incorrect",difficulty:2,answered_at:"2026-11-16T00:00:00Z"});
  const remote=canonical.words.get("word:one:meaning")!;
  assert.equal(await equivalentLearningDelta(active,previous,{...fresh,learning:canonical.snapshot(),learningIndex:new Map(canonical.words),learningDelta:{baseKey:"base",words:[remote],removed:[]}},[],[answer],catalog),false);
  assert.equal(cardKey(remote.source,remote.word_ref,remote.question_type),"word:one:meaning");
});

test("answers arriving during cooperative recovery are replayed once",async t=>{
  const source=await LearningEngine.create();
  for(let i=0;i<300;i++)source.apply({id:"old"+i,word_id:i?String(i):"one",source:"word",question_type:"meaning",result:"correct",difficulty:2,answered_at:"2026-11-14T00:00:00Z"});
  const played:Answer[]=[];t.mock.method(WorkBudget.prototype,"exhausted",()=>true);
  t.mock.method(WorkBudget.prototype,"yield",async()=>{if(!played.length)played.push(answer)});
  const recovered=await recoverLiveLearning(source.snapshot(),[],played,new Map([["word:one",word]]));
  assert.equal(recovered.learner.review_count,301);assert.equal(recovered.words.get("word:one:meaning")!.last_answer_id,"new");
  assert.equal(source.learner.review_count,300);
});
