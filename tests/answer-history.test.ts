import test from "node:test";
import assert from "node:assert/strict";
import { applyPacket, emptySnapshot, type SyncPacket } from "../lib/sync/types";
import { orderedRowMap, writeSyncRows } from "../lib/sync/row-store";
import { SyncEngine } from "../lib/sync/engine";

test("sync persists the answer delta even when its playable snapshot omits history", async () => {
  const snapshot=emptySnapshot("owner");snapshot.savedAt=1;snapshot.localCommit=5;snapshot.answerHistoryOmitted=true;
  let committed=false;
  await new SyncEngine("owner",{
    async read(){return snapshot},async pending(){return []},
    async commit(next,ids,delta){
      assert.deepEqual(next.data.answers,{});assert.equal(next.versions.answers,"1");assert.deepEqual(ids,[]);
      assert.equal(delta!.localCommit,5);assert.deepEqual(delta!.base,{});
      assert.equal(delta!.changes[0].key,"new");committed=true;
    },
  },{
    async manifest(){return{owner:"owner",protocol:1,versions:{answers:"1"}}},
    async push(){throw Error("no queued answers")},
    async pull(){return{owner:"owner",protocol:1,versions:{answers:"1"},changes:[
      {dataset:"answers",key:"new",version:"1",deleted:false,value:{id:"new"}},
    ]}},
  }).run();
  assert.equal(committed,true);
});

test("game projections advance answer versions without copying or retaining history", () => {
  const snapshot = emptySnapshot("owner"); snapshot.answerHistoryOmitted = true;
  const answers = snapshot.data.answers;
  const packet: SyncPacket = {owner:"owner",protocol:1,versions:{answers:"2",learning_states:"1"},changes:[
    {dataset:"answers",key:"new",version:"2",deleted:false,value:{id:"new"}},
    {dataset:"learning_states",key:"card",version:"1",deleted:false,value:{word_ref:"word"}},
  ]};
  const result = applyPacket(snapshot,packet);
  assert.equal(result.data.answers,answers);
  assert.deepEqual(result.data.answers,{});
  assert.equal(result.versions.answers,"2"); assert.equal(result.answerHistoryOmitted,true);
  assert.deepEqual(result.data.learning_states.card,{word_ref:"word"});
  assert.equal(packet.changes[0].value!.id,"new","history delta must remain available to the atomic commit");
});

test("history delta writes only changed UUIDs and leaves all other users untouched", async () => {
  type Row = {owner:string;key:string;ordinal:number;value:Record<string,unknown>};
  const rows=new Map<string,Row>([
    ["owner:old",{owner:"owner",key:"old",ordinal:0,value:{id:"old"}}],
    ["owner:keep",{owner:"owner",key:"keep",ordinal:1,value:{id:"keep"}}],
    ["other:old",{owner:"other",key:"old",ordinal:0,value:{id:"old"}}],
  ]);
  const writes: string[]=[];
  const store={
    async get([owner,key]:string[]){return rows.get(`${owner}:${key}`)},
    async put(row:Row){writes.push(row.key);rows.set(`${row.owner}:${row.key}`,row)},
    async delete([owner,key]:string[]){rows.delete(`${owner}:${key}`)},
    index(){throw Error("history delta scanned the full history")},
  };
  const snapshot=emptySnapshot("owner");snapshot.answerRows=true;snapshot.nextAnswerOrdinal=2;snapshot.answerHistoryOmitted=true;
  const changes:SyncPacket["changes"]=[
    {dataset:"answers",key:"old",version:"2",deleted:true,value:null},
    {dataset:"answers",key:"new",version:"2",deleted:false,value:{id:"new"}},
  ];
  const next=await writeSyncRows({objectStore(name:string){assert.equal(name,"history");return store}} as unknown as Parameters<typeof writeSyncRows>[0],
    "owner",snapshot,snapshot,{base:{answers:"1"},changes},[],"answers");
  assert.deepEqual(writes,["new"]);assert.equal(next,3);
  assert.ok(rows.has("other:old"));assert.ok(rows.has("owner:keep"));assert.equal(rows.has("owner:old"),false);
  assert.deepEqual(Object.keys(orderedRowMap([...rows.values()].filter(r=>r.owner==="owner"))),["keep","new"]);
});
