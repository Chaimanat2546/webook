import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const migrationDirectory = join(process.cwd(), "supabase", "migrations");
const migrationName = readdirSync(migrationDirectory).find((name) =>
  name.endsWith("_recover_failed_customer_project_token_rotation.sql"),
);

function readMigration(): string {
  assert.ok(migrationName, "Failed token rotation recovery migration is missing");
  return readFileSync(join(migrationDirectory, migrationName), "utf8")
    .replaceAll(/\s+/g, " ")
    .toLowerCase();
}

describe("Central User Manager failed token rotation recovery migration", () => {
  it("recovers only the exact failed unverified token bundle", () => {
    const sql = readMigration();

    assert.match(
      sql,
      /create function private\.recover_failed_customer_project_token_rotation\(\s*p_tenant_id uuid,\s*p_expected_token_version integer,\s*p_expected_kek_version integer,\s*p_actor_uid uuid,\s*p_event_id uuid\s*\)/,
    );
    assert.match(sql, /perform private\.require_central_user_service_role\(\)/);
    assert.match(
      sql,
      /from public\.users where uid = p_actor_uid and role_id = 1/,
    );
    assert.match(sql, /for update/);
    assert.match(sql, /bearer_token_version = p_expected_token_version/);
    assert.match(sql, /bearer_token_kek_version = p_expected_kek_version/);
    assert.match(sql, /is_active = false/);
    assert.match(sql, /provisioning_state is distinct from 'token_stored'/);
    assert.match(sql, /last_verified_token_version is not null/);
    assert.match(sql, /last_health_status is distinct from 'unhealthy'/);
    assert.match(
      sql,
      /last_health_safe_error is distinct from 'provider_failure'/,
    );
    assert.match(
      sql,
      /last_safe_error_code is distinct from 'provider_failure'/,
    );
    assert.match(sql, /last_health_checked_at < v_project\.bearer_token_updated_at/);
    assert.match(sql, /last_list_users_checked_at is not null/);
    assert.match(
      sql,
      /last_health_protocol_version is not null[\s\S]*last_health_tenant_id is not null[\s\S]*last_health_project_ref is not null[\s\S]*last_health_agent_version is not null[\s\S]*last_health_schema_version is not null[\s\S]*last_health_auth_attestation_version is not null[\s\S]*last_health_auth_attestation_digest is not null[\s\S]*last_health_auth_attestation_checked_at is not null/,
    );
  });

  it("preserves the failed bundle as a CAS anchor and audits one transition", () => {
    const sql = readMigration();

    assert.match(
      sql,
      /status in \('received', 'dispatching', 'in_progress', 'needs_review'\)/,
    );
    assert.match(
      sql,
      /set provisioning_state = 'rotation_gated', updated_at = clock_timestamp\(\)/,
    );
    assert.doesNotMatch(
      sql,
      /set[\s\S]{0,500}bearer_token_(?:ciphertext|iv|fingerprint|version|kek_version)\s*=/,
    );
    assert.match(
      sql,
      /'deactivate_project', 'succeeded', 'provider_failure', null, jsonb_build_object\(\s*'status', 'recovery_rotation_gate',\s*'tokenversion', p_expected_token_version,\s*'healthstatus', 'unhealthy'\s*\)/,
    );
    assert.match(
      sql,
      /provisioning_state = 'rotation_gated'[\s\S]*metadata ->> 'status' = 'recovery_rotation_gate'[\s\S]*metadata ->> 'tokenversion' = p_expected_token_version::text/,
    );
    assert.match(sql, /jsonb_build_object\(\s*'outcome', 'retry'/);
    assert.match(sql, /jsonb_build_object\(\s*'outcome', 'recovered'/);
  });

  it("exposes only a service-role wrapper and reloads PostgREST", () => {
    const sql = readMigration();

    assert.match(
      sql,
      /revoke all on function private\.recover_failed_customer_project_token_rotation\([^;]+ from public, anon, authenticated, service_role/,
    );
    assert.doesNotMatch(
      sql,
      /grant execute on function private\.recover_failed_customer_project_token_rotation/,
    );
    assert.match(
      sql,
      /revoke all on function public\.recover_failed_customer_project_token_rotation\([^;]+ from public, anon, authenticated, service_role/,
    );
    assert.match(
      sql,
      /grant execute on function public\.recover_failed_customer_project_token_rotation\([^;]+ to service_role/,
    );
    assert.match(sql, /notify pgrst, 'reload schema'/);
  });
});
