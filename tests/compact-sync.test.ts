import test from "node:test";
import assert from "node:assert/strict";
import { decodeSyncPage, type CompactSyncPage } from "../lib/sync/wire";
import { applyPacket, emptySnapshot } from "../lib/sync/types";
import { preparedGame } from "../lib/sync/prepared";

test("compact candidates preserve meaning-choice content and insertion order", () => {
  const snapshot = emptySnapshot("owner");
  for (let i = 0; i < 8; i++) snapshot.data.words[`w${i}`] = { id: `w${i}`, term: `語${i}`,
    kana: `かな${i}`, meaning_ko: `뜻${i}`, has_kanji: true, difficulty: 0, entry_type: "word" };
  const edges = [6,3,4,1,5,2].map(i => ({ dataset: "distractors" as const, key: `edge${i}`, version: "1", deleted: false,
    value: { target_word_id: "w0", candidate_source: "word", candidate_id: `w${i}`, status: "approved", question_type: "meaning" } }));
  // Every target must have an approved pool before preparing the catalog.
  for (let i = 1; i < 8; i++) edges.push(...Array.from({length:7},(_,j)=>j).filter(j=>j!==i).map(j => ({
    dataset: "distractors" as const, key: `e${i}-${j}`, version: "1", deleted: false,
    value: { target_word_id: `w${i}`, candidate_source: "word", candidate_id: `w${j}`, status: "approved", question_type: "meaning" } })));
  const original = { owner: "owner", protocol: 1 as const, versions: { words: "1", distractors: "1" }, changes: edges, done: false, after: ["1","last"] as [string,string] };
  const compact: CompactSyncPage = { ...original, content_schema: 1, changes: edges.map(e => ({ ...e,
    value: [e.value.target_word_id,"word",e.value.candidate_id] })) };
  const decoded = decodeSyncPage(compact);
  assert.deepEqual(decoded.changes, edges); assert.deepEqual(decoded.after, original.after);
  assert.deepEqual(preparedGame(applyPacket(snapshot,decoded),"1",["meaning"]).words, preparedGame(applyPacket(snapshot,original),"1",["meaning"]).words);
});
test("approval tombstones remove previously cached candidates; unknown schema is rejected", () => {
  const snapshot = emptySnapshot("owner"); snapshot.data.distractors.e = { status: "approved" };
  const page: CompactSyncPage = { owner:"owner",protocol:1,content_schema:1,versions:{distractors:"2"},done:true,after:null,
    changes:[{dataset:"distractors",key:"e",version:"2",deleted:true,value:null}] };
  assert.equal(applyPacket(snapshot,decodeSyncPage(page)).data.distractors.e,undefined);
  assert.throws(()=>decodeSyncPage({...page,content_schema:2} as unknown as CompactSyncPage),/INVALID_CONTENT_SCHEMA/);
  assert.throws(()=>decodeSyncPage({...page,changes:[{...page.changes[0],deleted:false,value:["x","bad","y"]}]} as unknown as CompactSyncPage),/INVALID_DISTRACTOR/);
});
