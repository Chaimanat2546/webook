import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const migrationDirectory = join(process.cwd(), "supabase", "migrations");
const migrationName = readdirSync(migrationDirectory).find((name) =>
  name.endsWith("_central_user_manager_bearer.sql"),
);

assert.ok(migrationName, "Central User Manager Bearer migration is missing");

const sql = readFileSync(join(migrationDirectory, migrationName), "utf8")
  .replaceAll(/\s+/g, " ")
  .toLowerCase();

function assertSql(pattern: RegExp) {
  assert.match(sql, pattern);
}

describe("Central User Manager Bearer migration", () => {
  it("creates the encrypted project registry with current-token activation proof", () => {
    assertSql(/create table public\.customer_projects/);
    for (const column of [
      "id uuid primary key",
      "display_name text not null",
      "target_supabase_project_ref text not null",
      "agent_origin text not null",
      "wrangler_environment text not null",
      "is_active boolean not null default false",
      "bearer_token_ciphertext text",
      "bearer_token_iv text",
      "bearer_token_version integer",
      "bearer_token_kek_version integer",
      "bearer_token_fingerprint text",
      "bearer_token_updated_at timestamp with time zone",
      "last_verified_token_version integer",
      "last_health_checked_at timestamp with time zone",
      "last_list_users_checked_at timestamp with time zone",
    ]) {
      assert.ok(sql.includes(column), `missing registry column: ${column}`);
    }

    assertSql(/octet_length\(bearer_token_ciphertext\) = 64/);
    assertSql(/octet_length\(bearer_token_iv\) = 16/);
    assertSql(/bearer_token_fingerprint ~ '\^\[0-9a-f\]\{64\}\$'/);
    assertSql(/bearer_token_version > 0/);
    assertSql(/bearer_token_kek_version > 0/);
    assertSql(/target_supabase_project_ref ~ '\^\[a-z0-9\]\{20\}\$'/);
    assertSql(/agent_origin ~ '\^https:/);
    assertSql(/agent_origin <> 'https:\/\/localhost'/);
    assertSql(/agent_origin !~ '.*local/);
    assertSql(/agent_origin !~ '.*\[0-9\].*\\\./);
    assertSql(
      /not is_active or \( bearer_token_version = last_verified_token_version[\s\S]*last_health_checked_at >= bearer_token_updated_at[\s\S]*last_list_users_checked_at >= bearer_token_updated_at/,
    );
  });

  it("creates immutable operation bindings and password-free safe results", () => {
    assertSql(/create table public\.user_management_operations/);
    for (const column of [
      "operation_id uuid primary key",
      "tenant_id uuid not null",
      "actor_uid uuid not null",
      "action text not null",
      "target_email_normalized text",
      "request_hash text not null",
      "status text not null",
      "safe_result jsonb",
      "dispatch_attempt_count integer not null default 0",
    ]) {
      assert.ok(sql.includes(column), `missing operation column: ${column}`);
    }

    assertSql(/references public\.customer_projects\(id\) on delete restrict/);
    assertSql(/action in \( 'list_users', 'create_user', 'reissue_temporary_password', 'suspend_user', 'reactivate_user' \)/);
    assertSql(/status in \( 'received', 'dispatching', 'completed', 'in_progress', 'needs_review', 'quarantined', 'failed_safe' \)/);
    assertSql(/request_hash ~ '\^\[0-9a-f\]\{64\}\$'/);
    assertSql(/action = 'list_users' and target_email_normalized is null/);
    assertSql(/action <> 'list_users' and target_email_normalized is not null/);
    assertSql(/octet_length\(safe_result::text\) <= 65536/);
    assertSql(/private\.central_user_safe_json\(safe_result\)/);
    assertSql(/regexp_replace\(lower\(v_key\), '\[\^a-z0-9\]', '', 'g'\)/);
    assertSql(/safe_error_code is null or safe_error_code ~ '\^\[a-z0-9_\]\{1,64\}\$'/);
    for (const forbiddenKeyFragment of [
      "password",
      "authorization",
      "credential",
      "raw",
      "provider",
      "origin",
      "projectref",
      "ciphertext",
      "fingerprint",
    ]) {
      assertSql(
        new RegExp(
          `v_normalized_key like '%${forbiddenKeyFragment}%'`,
        ),
      );
    }
    assertSql(/create trigger prevent_central_operation_binding_update/);
    assert.doesNotMatch(sql, /\btemporary_password\b/);
    assert.doesNotMatch(sql, /\bbearer_token\s+text\b/);
  });

  it("creates append-only audit without arbitrary request or response blobs", () => {
    assertSql(/create table public\.central_user_audit_events/);
    assertSql(/create trigger prevent_central_user_audit_mutation before update or delete/);
    assertSql(/raise exception using errcode = '42501'/);
    assert.doesNotMatch(sql, /\braw_(request|response|body|payload)\b/);
    assert.doesNotMatch(sql, /\b(before|after)_(json|state)\b/);
    assertSql(/action in \([\s\S]*'register_project'[\s\S]*'reconcile_operation'/);
    assertSql(/outcome in \([\s\S]*'succeeded'[\s\S]*'failed_safe'/);
  });

  it("uses RLS and explicit post-default-privilege revokes", () => {
    for (const table of [
      "customer_projects",
      "user_management_operations",
      "central_user_audit_events",
    ]) {
      assertSql(
        new RegExp(
          `alter table public\\.${table} enable row level security`,
        ),
      );
      assertSql(
        new RegExp(
          `revoke all privileges on table public\\.${table} from public, anon, authenticated, service_role`,
        ),
      );
    }

    assertSql(/create view public\.central_user_manager_projects with \(security_invoker = true\)/);
    const view = sql.match(
      /create view public\.central_user_manager_projects[\s\S]*?from public\.customer_projects;/,
    )?.[0];
    assert.ok(view);
    assert.doesNotMatch(
      view,
      /agent_origin|project_ref|wrangler|bearer_token|fingerprint|safe_error/,
    );
    assertSql(/grant select on public\.central_user_manager_projects to service_role/);
    assert.doesNotMatch(
      sql,
      /grant\s+(?:all|select|insert|update|delete)[^;]*\bto (?:anon|authenticated)\b/,
    );
  });

  it("creates narrow service-role transaction RPCs with no replay transition", () => {
    for (const functionName of [
      "register_customer_project",
      "claim_central_user_operation",
      "begin_central_user_dispatch",
      "complete_central_user_operation",
      "mark_central_user_operation_ambiguous",
      "reconcile_central_user_operation",
      "append_central_user_audit_event",
      "deactivate_customer_project",
      "rotate_customer_project_bearer",
      "record_customer_project_verification",
      "activate_customer_project",
    ]) {
      assertSql(new RegExp(`create function private\\.${functionName}\\(`));
      assertSql(new RegExp(`create function public\\.${functionName}\\(`));
      assertSql(
        new RegExp(
          `revoke all on function public\\.${functionName}\\([^;]+ from public, anon, authenticated`,
        ),
      );
      assertSql(
        new RegExp(
          `grant execute on function public\\.${functionName}\\([^;]+ to service_role`,
        ),
      );
    }

    assertSql(/security definer set search_path = pg_catalog, public, private/);
    assertSql(/auth\.jwt\(\) ->> 'role' <> 'service_role'/);
    assertSql(/status = 'received'[\s\S]*status = 'dispatching'/);
    assert.doesNotMatch(
      sql,
      /status\s+in\s+\([^)]*'needs_review'[^)]*\)[\s\S]{0,160}status\s*=\s*'dispatching'/,
    );
    assertSql(/is not distinct from/);
  });

  it("keeps rotation inactive and activation gated by current health and list proof", () => {
    assertSql(/update public\.customer_projects set is_active = false/);
    assertSql(/is_active = false, last_verified_token_version = null, last_health_checked_at = null, last_list_users_checked_at = null/);
    assertSql(/p_next_token_version <> p_expected_token_version \+ 1/);
    assertSql(/where id = p_tenant_id and is_active = false and coalesce\(bearer_token_version, 0\) = p_expected_token_version/);
    assertSql(/p_expected_token_version = 0 and p_next_token_version <> 1/);
    assertSql(/last_verified_token_version = p_token_version/);
    assertSql(/last_health_checked_at = case when p_check = 'health' then clock_timestamp\(\)/);
    assertSql(/last_list_users_checked_at = case when p_check = 'list_users' then clock_timestamp\(\)/);
    assertSql(/when p_check = 'health' then null else last_health_checked_at/);
    assertSql(/when p_check = 'list_users' then null else last_list_users_checked_at/);
    assertSql(/bearer_token_version = last_verified_token_version/);
    assertSql(/last_health_checked_at >= bearer_token_updated_at/);
    assertSql(/last_list_users_checked_at >= bearer_token_updated_at/);
  });

  it("revokes every new function and reloads the PostgREST schema", () => {
    assert.doesNotMatch(
      sql,
      /revoke all on all functions in schema private/,
    );
    assertSql(/grant usage on schema private to service_role/);
    for (const functionName of [
      "require_central_user_service_role",
      "central_user_safe_json",
      "prevent_central_operation_binding_update",
      "prevent_central_user_audit_mutation",
      "register_customer_project",
      "claim_central_user_operation",
      "begin_central_user_dispatch",
      "complete_central_user_operation",
      "mark_central_user_operation_ambiguous",
      "reconcile_central_user_operation",
      "append_central_user_audit_event",
      "deactivate_customer_project",
      "rotate_customer_project_bearer",
      "record_customer_project_verification",
      "activate_customer_project",
    ]) {
      assertSql(
        new RegExp(
          `revoke all on function private\\.${functionName}\\([^;]+ from public, anon, authenticated, service_role`,
        ),
      );
    }
    assertSql(/notify pgrst, 'reload schema'/);
  });
});
