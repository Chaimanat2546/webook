import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const migrationDirectory = join(process.cwd(), "supabase", "migrations");
const registryPath = join(
  process.cwd(),
  "scripts",
  "central-user-manager",
  "provisioning",
  "registry.mjs",
);
const migrationName = readdirSync(migrationDirectory).find((name) =>
  name.endsWith("_allow_active_customer_project_verification.sql"),
);

describe("Central User Manager active verification migration", () => {
  it("records verification only for provisioning or active completed tenants", () => {
    assert.ok(
      migrationName,
      "Active customer project verification migration is missing",
    );
    const sql = readFileSync(join(migrationDirectory, migrationName), "utf8")
      .replaceAll(/\s+/g, " ")
      .toLowerCase();

    assert.match(
      sql,
      /create or replace function private\.record_customer_project_verification\(/,
    );
    assert.match(
      sql,
      /\(is_active = false and provisioning_state = 'token_stored'\)/,
    );
    assert.match(
      sql,
      /\(is_active = true and provisioning_state = 'completed'\)/,
    );
    const recordFunctionSql = sql.split(
      "create or replace function private.begin_customer_project_token_rotation",
    )[0];
    assert.equal(
      recordFunctionSql.match(/is_active = false,/g)?.length,
      2,
      "both active failure paths must deactivate before clearing proof",
    );
    assert.doesNotMatch(
      recordFunctionSql,
      /rotation_gated/,
      "verification failure must not claim the operation-cleanup gate ran",
    );
    assert.match(
      sql,
      /\(\s*is_active = true or \(is_active = false and provisioning_state = 'completed'\)\s*\)/,
      "rotation gate must also clean up a tenant deactivated by verification failure",
    );
    assert.match(sql, /and bearer_token_version = p_token_version/);
    assert.match(
      sql,
      /revoke all on function private\.record_customer_project_verification\([^;]+ from public, anon, authenticated, service_role/,
    );
    assert.match(
      sql,
      /grant execute on function private\.record_customer_project_verification\([^;]+ to service_role/,
    );
    assert.match(sql, /notify pgrst, 'reload schema'/);
  });

  it("resumes a deactivated completed tenant through the real rotation gate", () => {
    const registry = readFileSync(registryPath, "utf8")
      .replaceAll(/\s+/g, " ")
      .toLowerCase();

    assert.match(
      registry,
      /\(current\.isactive && current\.provisioningstate === null\) \|\| current\.provisioningstate === "completed"/,
    );
    assert.match(
      registry,
      /return \{ phase: "active_expected", attestation, token: null \}/,
    );
  });
});
