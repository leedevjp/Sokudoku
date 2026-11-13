import test from "node:test";
import assert from "node:assert/strict";
import { readIdentity } from "../lib/supabase/read-identity";

function client(data: unknown, error: unknown = null) {
  return { auth: { async getClaims() { return { data, error }; },
    async getUser() { throw Error("Reads must not fetch the Auth user"); } } } as unknown as Parameters<typeof readIdentity>[0];
}

test("reads accept the subject only after successful JWT verification", async () => {
  assert.deepEqual(await readIdentity(client({ claims: { sub: "verified-user" } })), { id: "verified-user" });
  assert.equal(await readIdentity(client({ claims: { sub: "untrusted-user" } }, Error("invalid JWT"))), null);
});

test("missing sessions and malformed subjects cannot authorize a read", async () => {
  assert.equal(await readIdentity(client(null)), null);
  assert.equal(await readIdentity(client({ claims: {} })), null);
  assert.equal(await readIdentity(client({ claims: { sub: 123 } })), null);
});
