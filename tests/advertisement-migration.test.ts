import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

function advertisementMigrationSql() {
  const dir = join(process.cwd(), "supabase", "migrations");
  const file = readdirSync(dir).find((name) => name.endsWith("_advertisement_management.sql"));
  assert.ok(file, "advertisement migration exists");
  return readFileSync(join(dir, file), "utf8");
}

describe("advertisement migration", () => {
  it("creates the required tables and RLS policies", () => {
    const sql = advertisementMigrationSql();

    assert.match(sql, /create table public\.advertisements/);
    assert.match(sql, /create table public\.advertisement_images/);
    assert.match(sql, /advertisement_images_order_range check \(image_order between 1 and 2\)/);
    assert.match(sql, /alter table public\.advertisements enable row level security/);
    assert.match(sql, /Public can read active advertisements/);
    assert.match(sql, /Public can read active advertisement images/);
    assert.match(sql, /Administrators can manage advertisements/);
  });
});
