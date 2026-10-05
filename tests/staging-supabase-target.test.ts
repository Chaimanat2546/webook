import assert from "node:assert/strict";
import { test } from "node:test";
import { assertStagingProjectRef } from "../scripts/assert-staging-supabase-target.mjs";

test("staging migration target accepts only the fixed Staging project", () => {
  assert.doesNotThrow(() => assertStagingProjectRef("sxvkhzhqtrpxgzumsswl"));

  for (const target of [undefined, "rqizfiayvcbozlzuvbok", "another-project"]) {
    assert.throws(() => assertStagingProjectRef(target), /Invalid Staging Supabase target/);
  }
});
