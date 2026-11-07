import test from "node:test";
import assert from "node:assert/strict";
import { completeAuthCallback } from "../lib/auth/callback";

type Auth = Parameters<typeof completeAuthCallback>[1];
function authStub(options: { error?: string; signedIn?: boolean; throws?: boolean } = {}) {
  const calls: unknown[][] = [];
  const auth = {
    async exchangeCodeForSession(...args: unknown[]) {
      calls.push(args);
      if (options.throws) throw Error("connection failed");
      return { error: options.error ? { code: options.error } : null };
    },
    async getUser() {
      return { data: { user: options.signedIn ? { id: "verified-user" } : null } };
    },
  } as unknown as Auth;
  return { auth, calls };
}

test("successful legacy code exchange opens confirmation and forwards the matching PKCE flow", async () => {
  const { auth, calls } = authStub();
  assert.deepEqual(await completeAuthCallback(new URLSearchParams("code=test-code&sb_flow_id=test-flow"), auth), { destination: "/auth/confirmed?legacy=1" });
  assert.deepEqual(calls, [["test-code", { flowId: "test-flow" }]]);
});

test("missing verifier offers login recovery without claiming email confirmation", async () => {
  const { auth } = authStub({ error: "pkce_code_verifier_not_found" });
  assert.deepEqual(await completeAuthCallback(new URLSearchParams("code=test-code"), auth), {
    destination: "/auth/confirmed?legacy=1", diagnostic: "missing_verifier",
  });
});

test("signup fragments go to the confirmation page without a PKCE exchange or untrusted redirect", async () => {
  const { auth, calls } = authStub();
  const result = await completeAuthCallback(new URLSearchParams("signup=1&state=test-state&next=https://example.com"), auth);
  assert.deepEqual(result, { destination: "/auth/confirmed?state=test-state" });
  assert.equal(calls.length, 0);
});

test("a failed or reused code preserves an already verified login", async () => {
  const { auth } = authStub({ error: "flow_state_not_found", signedIn: true });
  assert.deepEqual(await completeAuthCallback(new URLSearchParams("code=used-code"), auth), { destination: "/" });
});

test("missing and rejected links do not exchange codes or trust redirect parameters", async () => {
  for (const query of ["next=https://example.com", "code=test&error=access_denied&error_description=private"]) {
    const { auth, calls } = authStub();
    const result = await completeAuthCallback(new URLSearchParams(query), auth);
    assert.equal(result.destination, "/auth/error?reason=link");
    assert.equal(calls.length, 0);
    assert.ok(!JSON.stringify(result).includes("private"));
  }
});

test("other exchange errors use a fixed diagnostic instead of provider details", async () => {
  const { auth } = authStub({ error: "some-provider-detail" });
  assert.equal((await completeAuthCallback(new URLSearchParams("code=test"), auth)).diagnostic, "exchange_failed");
});

test("transport errors reach the route's service-error handler", async () => {
  const { auth } = authStub({ throws: true });
  await assert.rejects(completeAuthCallback(new URLSearchParams("code=test"), auth), /connection failed/);
});
