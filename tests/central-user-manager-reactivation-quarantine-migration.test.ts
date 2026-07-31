import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260731101500_quarantine_needs_review_before_tenant_reactivation.sql",
);

function migrationSql(): string {
  return readFileSync(migrationPath, "utf8")
    .replaceAll(/\s+/g, " ")
    .toLowerCase();
}

describe("Central User Manager reactivation quarantine migration", () => {
  it("quarantines only ambiguous needs-review operations with one audit each", () => {
    const sql = migrationSql();

    assert.match(
      sql,
      /create or replace function private\.begin_customer_project_reactivation\(/,
    );
    assert.match(
      sql,
      /status in \('received', 'dispatching', 'in_progress'\)/,
    );
    assert.match(
      sql,
      /update public\.user_management_operations set status = 'quarantined'/,
    );
    assert.match(sql, /where tenant_id = p_tenant_id and status = 'needs_review'/);
    assert.match(sql, /safe_error_code = 'operation_ambiguous'/);
    assert.match(sql, /'quarantined'/);
    assert.match(sql, /'reactivation_gate'/);
    assert.doesNotMatch(
      sql,
      /status in \('dispatching', 'in_progress', 'needs_review'\)[\s\S]*returning/,
    );
  });

  it("checks project eligibility before mutating operations and preserves attempt ownership", () => {
    const sql = migrationSql();

    assert.match(sql, /is_active = false/);
    assert.match(sql, /bearer_token_version = p_expected_token_version/);
    assert.match(sql, /role_id = 1/);
    assert.match(
      sql,
      /v_project\.provisioning_state = 'completed'[\s\S]*v_can_begin := true/,
    );
    assert.match(
      sql,
      /if not v_can_begin then return null; end if;[\s\S]*update public\.user_management_operations/,
    );
    assert.match(
      sql,
      /v_project\.reactivation_attempt_id = p_attempt_id[\s\S]*v_outcome := 'retry'/,
    );
    assert.match(sql, /v_outcome := 'conflict'/);
    assert.match(sql, /reactivation_attempt_id = p_attempt_id/);
  });

  it("leaves private execution locked to the service-role wrapper", () => {
    const sql = migrationSql();

    assert.match(
      sql,
      /revoke all on function private\.begin_customer_project_reactivation\([\s\S]*from public, anon, authenticated, service_role/,
    );
    assert.match(
      sql,
      /grant execute on function public\.begin_customer_project_reactivation\([\s\S]*to service_role/,
    );
    assert.match(
      sql,
      /grant execute on function private\.claim_central_user_operation\([\s\S]*to service_role/,
    );
    assert.match(sql, /notify pgrst, 'reload schema'/);
  });

  it("serializes operation claims with reactivation and rolls back failed invariants", () => {
    const sql = migrationSql();
    const advisoryLock =
      /pg_advisory_xact_lock\(hashtextextended\(p_tenant_id::text, 0\)\)/g;

    assert.match(
      sql,
      /create or replace function private\.claim_central_user_operation\(/,
    );
    assert.equal(sql.match(advisoryLock)?.length, 2);
    assert.match(
      sql,
      /function private\.claim_central_user_operation\([\s\S]*pg_advisory_xact_lock[\s\S]*from public\.customer_projects where id = p_tenant_id and is_active = true and provisioning_state = 'completed'/,
    );
    assert.match(
      sql,
      /status in \('received', 'dispatching', 'in_progress', 'needs_review'\)[\s\S]*raise exception using errcode = '40001'/,
    );
  });
});
