import test from "node:test";
import assert from "node:assert/strict";
import { readInput } from "../lib/personal/input";

const request = (body: BodyInit, headers: Record<string, string> = {}) =>
  new Request("https://sokudoku.example/api/personal", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
    duplex: "half",
  } as RequestInit & { duplex: string });

test("only well-formed JSON with a JSON content type is read", async () => {
  assert.deepEqual(await readInput(request('{"term":"実装"}')), {
    term: "実装",
  });
  await assert.rejects(
    readInput(request("{}", { "Content-Type": "text/plain" })),
    /invalid_content_type/,
  );
  await assert.rejects(readInput(request("{")), SyntaxError);
  await assert.rejects(readInput(request(new Uint8Array([0xff]))), TypeError);
});

test("request limit applies during streaming even without Content-Length", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(16001));
      controller.enqueue(new Uint8Array(16001));
      controller.close();
    },
  });
  await assert.rejects(readInput(request(stream)), /too_large/);
  await assert.rejects(
    readInput(request("{}", { "Content-Length": "32001" })),
    /too_large/,
  );
  await assert.rejects(
    readInput(request(JSON.stringify("a".repeat(16001)))),
    /too_large/,
  );
});
