import test from "node:test";
import assert from "node:assert/strict";
import { orderedRowMap, writeSyncRows } from "../lib/sync/row-store";
import { emptySnapshot, type SyncDelta } from "../lib/sync/types";

test("card delta touches only its keys and preserves deletion/reinsert order", async () => {
  const rows = new Map([ ["z",{owner:"a",key:"z",ordinal:0,value:{id:"z"}}], ["a",{owner:"a",key:"a",ordinal:1,value:{id:"a"}}] ]);
  let scans = 0; const gets: string[] = [], puts: string[] = [];
  const store = {
    async get(key: string[]) { gets.push(key[1]); return rows.get(key[1]); },
    async put(row: (typeof rows extends Map<string,infer R> ? R : never)) { puts.push(row.key); rows.set(row.key,row); },
    async delete(key: string[]) { rows.delete(key[1]); },
    index() { scans++; throw Error("delta must not scan"); },
  };
  const snapshot = emptySnapshot("a"); snapshot.learningRows = true; snapshot.nextLearningOrdinal = 2;
  const delta: SyncDelta = { base:{},changes:[
    {dataset:"learning_states",key:"z",version:"2",deleted:true,value:null},
    {dataset:"learning_states",key:"z",version:"2",deleted:false,value:{id:"z"}},
  ] };
  const next = await writeSyncRows({objectStore:()=>store} as unknown as Parameters<typeof writeSyncRows>[0],"a",snapshot,snapshot,delta,[]);
  assert.equal(next,3); assert.equal(scans,0); assert.deepEqual(gets,["z"]); assert.deepEqual(puts,["z"]);
  assert.deepEqual(Object.keys(orderedRowMap([...rows.values()])),["a","z"]);
});

test("first row migration retains snapshot order and does not scan another owner's cards", async () => {
  const snapshot = emptySnapshot("a"); snapshot.data.learning_states={z:{id:"z"},a:{id:"a"}};
  const rows: unknown[] = [], writes: Promise<unknown>[] = [];
  const store={async put(row: unknown){rows.push(row)}};
  const next=await writeSyncRows({objectStore:()=>store} as unknown as Parameters<typeof writeSyncRows>[0],"a",snapshot,undefined,undefined,writes);
  await Promise.all(writes); assert.equal(next,2);
  assert.deepEqual(rows,[{owner:"a",key:"z",ordinal:0,value:{id:"z"}},{owner:"a",key:"a",ordinal:1,value:{id:"a"}}]);
});
