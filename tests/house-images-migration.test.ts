import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("house image mutation migration", () => {
  it("allows only users with accommodation tools to manage images", () => {
    const sql = readFileSync(
      new URL("../supabase/migrations/20260629043610_admin_manage_house_images.sql", import.meta.url),
      "utf8",
    );

    assert.match(sql, /grant insert, update, delete on table public\.images to authenticated/);
    assert.match(sql, /Administrators can read images/);
    assert.match(sql, /Administrators can manage images/);
    assert.match(sql, /allow_tools @> '\{"allow_accommodation": true\}'::jsonb/);
    assert.doesNotMatch(sql, /users\.mid is not null/);
    assert.doesNotMatch(sql, /users\.mid > 0/);
    assert.doesNotMatch(sql, /users\.role_id = 1/);
  });

  it("does not add a users constraint for accommodation mid", () => {
    const constraintMigration = new URL(
      "../supabase/migrations/20260629051529_require_accommodation_mid.sql",
      import.meta.url,
    );

    assert.equal(existsSync(constraintMigration), false);
  });
});
