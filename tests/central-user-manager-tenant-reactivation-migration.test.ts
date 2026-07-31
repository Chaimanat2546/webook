import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const migrations = join(process.cwd(), "supabase", "migrations");
const migrationName = readdirSync(migrations).find((name) =>
  name.endsWith("_central_user_manager_tenant_reactivation.sql"),
);

function migrationSql(): string {
  assert.ok(
    migrationName,
    "Central User Manager Tenant reactivation migration is missing",
  );
  return readFileSync(join(migrations, migrationName), "utf8")
    .replaceAll(/\s+/g, " ")
    .toLowerCase();
}

describe("Central User Manager Tenant reactivation migration", () => {
  it("opens a proof gate only for the exact inactive completed Tenant generation", () => {
    const sql = migrationSql();

    assert.match(sql, /'reactivation_verifying'/);
    assert.match(
      sql,
      /create function private\.begin_customer_project_reactivation\(/,
    );
    assert.match(sql, /perform private\.require_central_user_service_role\(\)/);
    assert.match(sql, /role_id = 1/);
    assert.match(sql, /is_active = false/);
    assert.match(sql, /provisioning_state = 'completed'/);
    assert.match(sql, /bearer_token_version = p_expected_token_version/);
    assert.match(
      sql,
      /status in \('received', 'dispatching', 'in_progress', 'needs_review'\)/,
    );
    assert.match(sql, /provisioning_state = 'reactivation_verifying'/);
    assert.match(sql, /reactivation_attempt_id = p_attempt_id/);
    assert.match(
      sql,
      /reactivation_attempt_id = p_attempt_id[\s\S]*?then v_outcome := 'retry'/,
    );
    assert.match(sql, /v_outcome := 'conflict'/);
    assert.match(sql, /safe_error_code[\s\S]*'operation_conflict'/);
    assert.match(sql, /reactivation_started_at = v_now/);
    assert.match(sql, /last_verified_token_version = null/);
    assert.match(sql, /last_health_checked_at = null/);
    assert.match(sql, /last_list_users_checked_at = null/);
  });

  it("records only exact health identity or bounded list proof while inactive", () => {
    const sql = migrationSql();

    assert.match(
      sql,
      /create function private\.record_customer_project_reactivation_verification\(/,
    );
    assert.match(sql, /provisioning_state = 'reactivation_verifying'/);
    assert.match(sql, /reactivation_attempt_id = p_attempt_id/);
    assert.match(sql, /p_check not in \('health', 'list_users'\)/);
    assert.match(sql, /p_health_tenant_id = p_tenant_id/);
    assert.match(
      sql,
      /p_health_project_ref = v_project\.target_supabase_project_ref/,
    );
    assert.match(
      sql,
      /p_health_auth_attestation_digest = v_project\.auth_attestation_digest/,
    );
    assert.match(sql, /last_health_status = 'healthy'/);
    assert.match(sql, /last_list_users_checked_at = v_now/);
    assert.match(sql, /is_active = false/);
    assert.match(
      sql,
      /not p_succeeded[\s\S]*provisioning_state = 'completed'[\s\S]*reactivation_attempt_id = null/,
    );
  });

  it("allows a fresh attempt after health succeeds but bounded list verification fails", () => {
    const sql = migrationSql();

    assert.match(
      sql,
      /p_check = 'list_users' then null else last_list_users_checked_at/,
    );
    assert.match(sql, /last_safe_error_code = p_safe_error_code/);
    assert.match(
      sql,
      /provisioning_state = 'completed'[\s\S]*last_verified_token_version is null[\s\S]*last_health_status = 'healthy'[\s\S]*last_safe_error_code is not null/,
    );
  });

  it("activates atomically only after both proofs are fresh for this gate", () => {
    const sql = migrationSql();

    assert.match(
      sql,
      /create function private\.activate_customer_project_after_reverification\(/,
    );
    assert.match(sql, /reactivation_attempt_id = p_attempt_id/);
    assert.match(
      sql,
      /bearer_token_version = last_verified_token_version/,
    );
    assert.match(sql, /last_health_status = 'healthy'/);
    assert.match(
      sql,
      /last_health_checked_at >= reactivation_started_at/,
    );
    assert.match(
      sql,
      /last_list_users_checked_at >= reactivation_started_at/,
    );
    assert.match(sql, /set is_active = true/);
    assert.match(sql, /provisioning_state = 'completed'/);
    assert.match(sql, /reactivation_attempt_id = null/);
    assert.match(sql, /reactivation_started_at = null/);
    assert.match(sql, /'activate_project'/);
    assert.match(sql, /'reactivation_reverified'/);
  });

  it("keeps implementations private and exposes only service-role wrappers", () => {
    const sql = migrationSql();

    for (const name of [
      "begin_customer_project_reactivation",
      "record_customer_project_reactivation_verification",
      "activate_customer_project_after_reverification",
    ]) {
      assert.match(
        sql,
        new RegExp(
          `revoke all on function private\\.${name}\\([^;]+ from public, anon, authenticated, service_role`,
        ),
      );
      assert.match(
        sql,
        new RegExp(
          `revoke all on function public\\.${name}\\([^;]+ from public, anon, authenticated, service_role`,
        ),
      );
      assert.match(
        sql,
        new RegExp(
          `grant execute on function public\\.${name}\\([^;]+ to service_role`,
        ),
      );
    }
    assert.match(sql, /notify pgrst, 'reload schema'/);
  });
});
