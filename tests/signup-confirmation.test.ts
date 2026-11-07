import test from "node:test";
import assert from "node:assert/strict";
import { confirmSignup, pendingSignup, signupRedirect, SIGNUP_PENDING_KEY, type PendingSignup } from "../lib/auth/signup-confirmation";

const pending: PendingSignup = { state: "test-state", email: "test@example.com", createdAt: 1000 };
const hash = () => new URLSearchParams("access_token=test-access&refresh_token=test-refresh&type=signup");
type Verify = Parameters<typeof confirmSignup>[1];
type Session = Parameters<typeof confirmSignup>[2];
function clients(options: { confirmed?: boolean; email?: string; invalid?: boolean; sessionFails?: boolean; currentId?: string } = {}) {
  const verified: string[] = [], sessions: unknown[] = [];
  const verifier = { async getUser(token: string) { verified.push(token); return {
    data: { user: options.invalid ? null : { id: "verified", email: options.email ?? pending.email,
      email_confirmed_at: options.confirmed === false ? null : "2026-11-07" } },
    error: options.invalid ? { code: "bad_jwt" } : null,
  }; } } as unknown as Verify;
  const session = {
    async getUser() { return { data: { user: options.currentId ? { id: options.currentId, email_confirmed_at: "2026-11-07" } : null }, error: null }; },
    async setSession(value: unknown) { sessions.push(value); return { error: options.sessionFails ? { code: "network" } : null }; },
  } as unknown as Session;
  return { verifier, session, verified, sessions };
}

test("a different browser confirms email without saving a session", async () => {
  const c = clients();
  assert.equal(await confirmSignup(hash(), c.verifier, c.session, null), "confirmed");
  assert.deepEqual(c.verified, ["test-access"]);
  assert.deepEqual(c.sessions, []);
});
test("the matching signup browser may sign in, but a session failure keeps confirmation successful", async () => {
  const c = clients();
  assert.equal(await confirmSignup(hash(), c.verifier, c.session, pending), "signed-in");
  assert.deepEqual(c.sessions, [{ access_token: "test-access", refresh_token: "test-refresh" }]);
  const failed = clients({ sessionFails: true });
  assert.equal(await confirmSignup(hash(), failed.verifier, failed.session, pending), "confirmed");
});
test("a different pending email or already logged-in account cannot be replaced", async () => {
  for (const options of [{ email: "someone-else@example.com" }, { currentId: "someone-else" }]) {
    const c = clients(options);
    assert.equal(await confirmSignup(hash(), c.verifier, c.session, pending), "confirmed");
    assert.deepEqual(c.sessions, []);
  }
});
test("unverified, invalid, expired and wrong-purpose tokens cannot claim confirmation", async () => {
  for (const options of [{ confirmed: false }, { invalid: true }]) {
    const c = clients(options);
    assert.equal(await confirmSignup(hash(), c.verifier, c.session, null), "invalid");
  }
  const c = clients();
  for (const fragment of ["", "confirmed=1", "error=access_denied", "access_token=x&type=recovery"]) {
    assert.equal(await confirmSignup(new URLSearchParams(fragment), c.verifier, c.session, null), "invalid");
  }
  assert.deepEqual(c.sessions, []);
});
test("legacy links without browser state offer login without asserting unverified success", async () => {
  const c = clients();
  assert.equal(await confirmSignup(new URLSearchParams(), c.verifier, c.session, null, true), "check-login");
});
test("signup state is optional for verification but must match and be recent for automatic login", () => {
  let stored: string | null = null;
  const storage = { setItem(key: string, value: string) { assert.equal(key, SIGNUP_PENDING_KEY); stored = value; },
    getItem() { return stored; }, removeItem() { stored = null; } };
  const redirect = new URL(signupRedirect("https://example.com", " TEST@example.com ", storage, "test-state", 1000));
  assert.equal(redirect.pathname, "/auth/callback");
  assert.equal(redirect.searchParams.get("state"), "test-state");
  assert.deepEqual(pendingSignup(storage, "test-state", 2000), pending);
  assert.equal(pendingSignup(storage, "wrong-state", 2000), null);
  assert.equal(pendingSignup(storage, "test-state", 3601001), null);
  assert.equal(pendingSignup(storage, "test-state", 999), null);
  assert.equal(pendingSignup(null, "test-state"), null);
  assert.ok(signupRedirect("https://example.com", pending.email, null, "state"));
});
