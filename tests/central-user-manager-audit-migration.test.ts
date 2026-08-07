import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260802090000_central_user_manager_rpc_audit.sql", import.meta.url),
  "utf8",
);

describe("central user manager audit migration", () => {
  it("stores only safe operation metadata under forced RLS", () => {
    assert.match(migration, /create table public\.central_user_audit_events/i);
    assert.match(migration, /operation_id uuid primary key/i);
    assert.match(migration, /central_user_audit_tenant_time_idx/i);
    assert.match(migration, /alter table public\.central_user_audit_events force row level security/i);
    assert.match(migration, /revoke all .* from public, anon, authenticated, service_role/i);
    assert.match(migration, /grant select, insert, update .* to service_role/i);
    assert.doesNotMatch(migration, /drop table/i);
    assert.doesNotMatch(migration, /\b(email|password|payload|token|origin|binding)\b/i);
  });
});
