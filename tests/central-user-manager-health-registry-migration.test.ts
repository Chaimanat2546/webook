import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const migrationDirectory = join(process.cwd(), "supabase", "migrations");
const migrationName = readdirSync(migrationDirectory).find((name) =>
  name.endsWith("_central_user_manager_health_attestation.sql"),
);

assert.ok(
  migrationName,
  "Central User Manager health attestation migration is missing",
);

const sql = readFileSync(join(migrationDirectory, migrationName), "utf8")
  .replaceAll(/\s+/g, " ")
  .toLowerCase();

function assertSql(pattern: RegExp) {
  assert.match(sql, pattern);
}

describe("Central User Manager health attestation migration", () => {
  it("adds expected and last-verified identity/version proof", () => {
    for (const column of [
      "expected_agent_version text",
      "expected_schema_version text",
      "auth_attestation_version text",
      "auth_attestation_digest text",
      "auth_attestation_checked_at timestamp with time zone",
      "last_health_status text",
      "last_health_safe_error text",
      "last_health_protocol_version integer",
      "last_health_tenant_id uuid",
      "last_health_project_ref text",
      "last_health_agent_version text",
      "last_health_schema_version text",
      "last_health_auth_attestation_version text",
      "last_health_auth_attestation_digest text",
      "last_health_auth_attestation_checked_at timestamp with time zone",
    ]) {
      assert.ok(sql.includes(column), `missing health registry column: ${column}`);
    }

    assertSql(/expected_agent_version ~ '\^\[a-za-z0-9\]\[a-za-z0-9\._-\]\{0,63\}\$'/);
    assertSql(/expected_schema_version ~ '\^\[a-za-z0-9\]\[a-za-z0-9\._-\]\{0,63\}\$'/);
    assertSql(/auth_attestation_digest ~ '\^\[0-9a-f\]\{64\}\$'/);
    assertSql(/last_health_status in \('unknown', 'healthy', 'unhealthy'\)/);
    assertSql(/create unique index customer_projects_agent_origin_key/);
  });

  it("replaces registration with exact expected version and attestation input", () => {
    assertSql(/drop function public\.register_customer_project\(uuid, text, text, text, text\)/);
    assertSql(/drop function private\.register_customer_project\(uuid, text, text, text, text\)/);
    assertSql(/create function private\.register_customer_project\([\s\S]*p_expected_agent_version text[\s\S]*p_expected_schema_version text[\s\S]*p_auth_attestation_version text[\s\S]*p_auth_attestation_digest text[\s\S]*p_auth_attestation_checked_at timestamp with time zone/);
    assertSql(/create function public\.register_customer_project\(/);
    assertSql(/is_active[\s\S]*false/);
    assertSql(/p_expected_agent_version is null[\s\S]*central_user_manager_invalid_health_contract/);
    assertSql(/p_expected_schema_version is null[\s\S]*central_user_manager_invalid_health_contract/);
    assertSql(/p_auth_attestation_digest is null[\s\S]*central_user_manager_invalid_health_contract/);
  });

  it("records health only when the complete Agent identity matches registry", () => {
    assertSql(/drop function public\.record_customer_project_verification\(uuid, integer, text, boolean, text\)/);
    assertSql(/drop function private\.record_customer_project_verification\(uuid, integer, text, boolean, text\)/);
    assertSql(/p_health_protocol_version integer/);
    assertSql(/p_health_tenant_id uuid/);
    assertSql(/p_health_project_ref text/);
    assertSql(/p_health_agent_version text/);
    assertSql(/p_health_schema_version text/);
    assertSql(/p_health_auth_attestation_version text/);
    assertSql(/p_health_auth_attestation_digest text/);
    assertSql(/p_health_auth_attestation_checked_at timestamp with time zone/);
    assertSql(/p_health_protocol_version = 1/);
    assertSql(/p_health_tenant_id = p_tenant_id/);
    assertSql(/p_health_project_ref = v_project\.target_supabase_project_ref/);
    assertSql(/p_health_agent_version = v_project\.expected_agent_version/);
    assertSql(/p_health_schema_version = v_project\.expected_schema_version/);
    assertSql(
      /p_health_auth_attestation_digest = v_project\.auth_attestation_digest/,
    );
    assertSql(/last_health_status = 'healthy'/);
    assertSql(/last_health_status = 'unhealthy'/);
    assertSql(/last_health_safe_error = case when p_check = 'health' then p_safe_error_code else last_health_safe_error end/);
  });

  it("requires current complete health and list proof before activation", () => {
    assertSql(/drop constraint customer_projects_activation_proof/);
    assertSql(/add constraint customer_projects_activation_proof check/);
    assertSql(/last_health_status = 'healthy'/);
    assertSql(/last_health_protocol_version = 1/);
    assertSql(/last_health_tenant_id = id/);
    assertSql(/last_health_project_ref = target_supabase_project_ref/);
    assertSql(/last_health_agent_version = expected_agent_version/);
    assertSql(/last_health_schema_version = expected_schema_version/);
    assertSql(/last_health_auth_attestation_version = auth_attestation_version/);
    assertSql(/last_health_auth_attestation_digest = auth_attestation_digest/);
    assertSql(/last_health_auth_attestation_checked_at = auth_attestation_checked_at/);
    assertSql(/last_list_users_checked_at >= bearer_token_updated_at/);
  });

  it("exposes only nonsecret project health status and exact grants", () => {
    assertSql(/create or replace view public\.central_user_manager_projects with \(security_invoker = true\)/);
    const view = sql.match(
      /create or replace view public\.central_user_manager_projects[\s\S]*?from public\.customer_projects;/,
    )?.[0];
    assert.ok(view);
    assert.match(view, /expected_agent_version/);
    assert.match(view, /expected_schema_version/);
    assert.match(view, /last_health_status/);
    assert.match(view, /last_health_safe_error/);
    assert.doesNotMatch(
      view,
      /agent_origin|project_ref|wrangler|digest|ciphertext|bearer_token|fingerprint/,
    );

    assertSql(/revoke all on function public\.register_customer_project\([^;]+ from public, anon, authenticated, service_role/);
    assertSql(/grant execute on function public\.register_customer_project\([^;]+ to service_role/);
    assertSql(/revoke all on function public\.record_customer_project_verification\([^;]+ from public, anon, authenticated, service_role/);
    assertSql(/grant execute on function public\.record_customer_project_verification\([^;]+ to service_role/);
    assertSql(/notify pgrst, 'reload schema'/);
  });
});
