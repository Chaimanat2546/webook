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

function migrationSqlBySuffix(suffix: string) {
  const dir = join(process.cwd(), "supabase", "migrations");
  const file = readdirSync(dir).find((name) => name.endsWith(suffix));
  assert.ok(file, `${suffix} migration exists`);
  return readFileSync(join(dir, file), "utf8");
}

function allMigrationSql() {
  const dir = join(process.cwd(), "supabase", "migrations");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => readFileSync(join(dir, name), "utf8"))
    .join("\n");
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

  it("uses accommodation permission for advertisement management", () => {
    const sql = allMigrationSql();

    assert.match(sql, /drop policy if exists "Administrators can manage advertisements"/);
    assert.match(sql, /drop policy if exists "Administrators can manage advertisement images"/);
    assert.match(sql, /users\.allow_tools @> '\{"allow_accommodation": true\}'::jsonb/);
  });

  it("stores advertisement image object paths", () => {
    const sql = allMigrationSql();

    assert.match(sql, /add column image_path text generated always as/);
    assert.match(sql, /advertisements\/' \|\| advertisement_id::text \|\| '\/' \|\| image_name/);
  });

  it("adds a house listing zone to advertisements", () => {
    const sql = migrationSqlBySuffix("_advertisement_zone.sql");

    assert.match(sql, /add column zone text/);
    assert.match(sql, /set zone = 'pattaya'/);
    assert.match(sql, /alter column zone set not null/);
    assert.match(sql, /advertisements_zone_check/);
    assert.doesNotMatch(sql, /'all'/);
    assert.match(sql, /bangkok/);
    assert.match(sql, /sattahip/);
    assert.match(sql, /advertisements_zone_active_updated_idx/);
  });

  it("adds the cross-zone advertisement value after the base zone migration", () => {
    const sql = migrationSqlBySuffix("_advertisement_all_zone.sql");

    assert.match(sql, /drop constraint advertisements_zone_check/);
    assert.match(sql, /add constraint advertisements_zone_check/);
    assert.match(sql, /'all'/);
    assert.match(sql, /'sattahip'/);
  });
});
