import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { LearningEngine } from "../lib/game/learning/engine";
import { TrainingPlanner } from "../lib/game/learning/planner";
import { WorkBudget } from "../lib/game/learning/work-budget";
import type { Kind, Word } from "../lib/game/types";
import type { TrainingMode } from "../lib/game/learning/types";

const fixed=Date.parse("2026-11-15T00:00:00Z");
const seeded=(seed:number)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
async function fixture(personal:boolean,future:boolean){
  const words:Word[]=Array.from({length:120},(_,i)=>({id:String(i),term:"term"+i,kana:"かな"+i,meaning_ko:"meaning"+i,hanja_reading:null,has_kanji:i%3!==0,difficulty:i%10,deleted_at:null,...(personal?{source:"personal" as const}:{})}));
  for(const [i,w]of words.entries()){
    if(!personal)w.meaning_choices=Array.from({length:12},(_,j)=>({id:String((i+j+1)%words.length),meaning_ko:"meaning"+((i+j+1)%words.length),hanja_reading:null,kana:""}));
    w.reading_choices=Array.from({length:20},(_,j)=>words[(i+j+1)%words.length]);
  }
  const engine=await LearningEngine.create();
  for(const [i,w]of words.entries())if(future||i<60)for(const kind of ["meaning","reading"] as Kind[]){
    if(kind==="reading"&&!w.has_kanji)continue;
    engine.apply({id:"old-"+i+"-"+kind,word_id:w.id,source:personal?"personal":"word",question_type:kind,difficulty:w.difficulty,result:future?"correct":i%4===0?"incorrect":"correct",answered_at:new Date(fixed-(future?0:4*86400000)).toISOString()});
  }
  return{words,engine};
}

// These traces were captured from the pre-optimization main planner, not
// regenerated from the new implementation. They cover ordering and RNG use.
for(const [name,mode,kinds,personal,future,hash]of [
  ["auto mixed",["auto"],["meaning","reading"],false,false,"78989ebd2a12632e8ce882817f7f2795039148bd78b2396b97e8ff0ffdcacef0"],
  ["auto personal",["auto"],["meaning"],true,false,"7193989ce2eed3f3c5fa1170ff501508c94e295673d0ade38452c114bd261049"],
  ["auto maintenance",["auto"],["meaning","reading"],false,true,"2bbc5505a32fc49f4e41ec8e55daf8fb1f1b1924e8bc3416628c1a149325d133"],
  ["exploration/review",["exploration","review"],["meaning","reading"],false,false,"4869b9ce719f9ce464e06fde13819f15329c17f3561f7e37fcee1185d6c5dc5f"],
] as [string,TrainingMode[],Kind[],boolean,boolean,string][])test("cooperative selection preserves main's trace: "+name,async t=>{
  t.mock.method(Date,"now",()=>fixed);
  const {words,engine}=await fixture(personal,future),planner=new TrainingPlanner(engine,words,kinds,mode,seeded(147)),trace=[];
  for(let i=0;i<150;i++){
    await planner.prepareSet();const q=planner.next();if(!q)break;
    trace.push([q.word.id,q.kind,q.mode,q.options.map(c=>c.id)]);
    planner.record({id:"answer-"+i,word_id:q.word.id,source:personal?"personal":"word",question_type:q.kind,selected_word_id:i%5===0?q.options.find(c=>c.id!==q.word.id)!.id:q.word.id,result:i%5===0?"incorrect":"correct",response_ms:200,time_limit_ms:10000,answered_at:new Date(fixed+i*1000).toISOString()},q.word);
  }
  assert.equal(createHash("sha256").update(JSON.stringify(trace)).digest("hex"),hash);
});

test("set preparation yields UI time but never preselects the following set",async t=>{
  const {words,engine}=await fixture(false,false),planner=new TrainingPlanner(engine,words,["meaning"],["auto"],seeded(147));
  let yields=0;t.mock.method(WorkBudget.prototype,"exhausted",()=>true);
  t.mock.method(WorkBudget.prototype,"yield",async()=>{yields++});
  await planner.prepareSet();assert.ok(yields>0);const first=yields;
  for(let i=0;i<5;i++){
    const q=planner.next()!;
    planner.record({id:"answered"+i,word_id:q.word.id,question_type:q.kind,selected_word_id:q.word.id,result:"correct",response_ms:200,time_limit_ms:10000,answered_at:new Date(fixed+i*1000).toISOString()},q.word);
    if(i<4){await planner.prepareSet();assert.equal(yields,first)}
  }
  await planner.prepareSet();assert.ok(yields>first);
});
