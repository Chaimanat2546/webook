import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("custom worker schedules waiting-booking expiry every minute", () => {
  const worker = readFileSync(new URL("../worker.ts", import.meta.url), "utf8");
  const production = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
  const staging = JSON.parse(readFileSync(new URL("../wrangler.staging.jsonc", import.meta.url), "utf8"));
  assert.match(worker, /fetch: handler\.fetch/);
  assert.match(worker, /async scheduled/);
  assert.match(worker, /expireWaitingBookings/);
  assert.deepEqual(production.triggers.crons, ["* * * * *"]);
  assert.deepEqual(staging.triggers.crons, ["* * * * *"]);
});
