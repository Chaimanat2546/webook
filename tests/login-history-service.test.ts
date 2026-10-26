import assert from "node:assert/strict";
import { test } from "node:test";
import { LoginHistoryError, type LoginHistoryEntry, type RecordLoginInput } from "../lib/login-history.ts";
import { recordSuccessfulLogin } from "../server/services/login-history.ts";
const input: RecordLoginInput = { userId:"10000000-0000-4000-8000-000000000001",sessionId:"30000000-0000-4000-8000-000000000001",loggedInAt:"2026-10-26T10:00:00Z",ipAddress:null,os:"unknown",browser:"unknown",deviceType:"unknown" };
test("transient metadata failure retries the same login exactly once", async () => {
  let attempts = 0;
  const entry = { id:"40000000-0000-4000-8000-000000000001" } as LoginHistoryEntry;
  const result = await recordSuccessfulLogin({ record: async value => {
    assert.deepEqual(value,input); attempts++;
    if (attempts===1) throw new LoginHistoryError(503,true);
    return entry;
  } },input);
  assert.equal(result.id,entry.id); assert.equal(attempts,2);
});
test("permanent or repeated metadata errors terminate rather than retrying auth", async () => {
  for (const transient of [true,false]) {
    let attempts=0;
    await assert.rejects(() => recordSuccessfulLogin({ record: async () => { attempts++; throw new LoginHistoryError(503,transient); } },input));
    assert.equal(attempts,transient?2:1);
  }
});
test("metadata writes abort on their deadline without detached database work", async () => {
  await assert.rejects(() => recordSuccessfulLogin({ record: async (_value,signal) => new Promise((_resolve,reject) => {
    signal!.addEventListener("abort",() => reject(new LoginHistoryError(503)),{once:true});
  }) },input,10));
});
