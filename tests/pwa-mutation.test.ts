import assert from "node:assert/strict";
import { test } from "node:test";
import { attemptMutation } from "../lib/pwa/mutation.ts";

test("received validation and success results remain available to the form", async () => {
  for (const result of [{ ok: true, id: "saved" }, { ok: false, formError: "invalid" }]) {
    assert.deepEqual(await attemptMutation(async () => result), { received: true, result });
  }
});

test("a lost response never retries a potentially committed mutation", async () => {
  let writes = 0;
  const outcome = await attemptMutation(async () => {
    writes += 1;
    throw new TypeError("response lost");
  });
  assert.equal(writes, 1);
  assert.deepEqual(outcome, { received: false });
});
