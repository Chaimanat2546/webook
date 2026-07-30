import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const migrationDirectory = join(process.cwd(), "supabase", "migrations");
const migrationName = readdirSync(migrationDirectory).find((name) =>
  name.endsWith("_central_user_manager_atomic_finalization.sql"),
);

assert.ok(
  migrationName,
  "Central User Manager atomic finalization migration is missing",
);

const sql = readFileSync(join(migrationDirectory, migrationName), "utf8")
  .replaceAll(/\s+/g, " ")
  .toLowerCase();

function assertSql(pattern: RegExp) {
  assert.match(sql, pattern);
}

describe("Central User Manager atomic finalization migration", () => {
  it("allows only the version metadata from the safe user contract", () => {
    assertSql(/create or replace function private\.central_user_safe_json/);
    assertSql(/v_normalized_key like '%credential%'[\s\S]*v_normalized_key not in \([\s\S]*'credentialversion',[\s\S]*'authcredentialversion'/);
    assertSql(/v_normalized_key like '%password%'/);
    assertSql(/v_normalized_key like '%secret%'/);
  });

  it("adds an allowlisted nullable Agent stage", () => {
    assertSql(/add column agent_stage text/);
    for (const stage of [
      "listed",
      "completed",
      "needs_review",
      "provider_intent",
      "auth_create_intent",
      "global_signout_rejected",
    ]) {
      assert.ok(sql.includes(`'${stage}'`), `missing Agent stage ${stage}`);
    }
    assertSql(/agent_stage is null or agent_stage in/);
  });

  it("returns durable Agent stage on exact claim retry", () => {
    assertSql(/create or replace function private\.claim_central_user_operation/);
    assertSql(/'agentstage', v_existing\.agent_stage/);
  });

  it("atomically finalizes the operation and its audit event", () => {
    assertSql(/create function private\.finalize_central_user_operation/);
    assertSql(/p_expected_status text/);
    assertSql(/p_next_status text/);
    assertSql(/p_agent_stage text/);
    assertSql(/p_safe_result jsonb/);
    assertSql(/p_safe_error_code text/);
    assertSql(/p_event_id uuid/);
    assertSql(/update public\.user_management_operations[\s\S]*where operation_id = p_operation_id[\s\S]*and request_hash = p_request_hash[\s\S]*and status = p_expected_status/);
    assertSql(/if not found then return false/);
    assertSql(/insert into public\.central_user_audit_events/);
    assertSql(/return true/);
  });

  it("enforces correlated status, result, error, and stage invariants", () => {
    assertSql(/p_next_status = 'completed'[\s\S]*p_safe_result is not null[\s\S]*p_agent_stage is not null/);
    assertSql(/p_next_status = 'failed_safe'[\s\S]*p_safe_result is null[\s\S]*p_safe_error_code is not null/);
    assertSql(/p_next_status in \('in_progress', 'needs_review', 'quarantined'\)[\s\S]*p_safe_result is null[\s\S]*p_safe_error_code is not null/);
    assertSql(/jsonb_typeof\(p_metadata\) <> 'object'/);
    assertSql(/central_user_operation_invalid_finalization/);
  });

  it("retires bypass RPCs and grants only the atomic boundary", () => {
    for (const name of [
      "complete_central_user_operation",
      "mark_central_user_operation_ambiguous",
      "reconcile_central_user_operation",
    ]) {
      assertSql(new RegExp(`drop function public\\.${name}`));
      assertSql(new RegExp(`drop function private\\.${name}`));
    }
    assertSql(/revoke all on function public\.finalize_central_user_operation\([^;]+ from public, anon, authenticated, service_role/);
    assertSql(/grant execute on function public\.finalize_central_user_operation\([^;]+ to service_role/);
    assertSql(/notify pgrst, 'reload schema'/);
  });
});
