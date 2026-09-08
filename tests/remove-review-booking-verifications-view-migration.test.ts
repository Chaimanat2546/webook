import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const name = readdirSync(new URL("../supabase/migrations/", import.meta.url))
  .find((entry) => entry.endsWith("_remove_review_booking_verifications_view.sql"));

describe("remove review booking verification view migration", () => {
  it("removes only the obsolete verification view and reloads the schema", () => {
    assert.ok(name, "view removal migration must exist");
    const sql = readFileSync(
      new URL(`../supabase/migrations/${name}`, import.meta.url),
      "utf8",
    );

    assert.match(sql, /drop view if exists public\.review_booking_verifications;/i);
    assert.match(sql, /notify pgrst, 'reload schema';/i);
    assert.doesNotMatch(sql, /^\s*(?:drop table|truncate)\b/im);
  });
});
