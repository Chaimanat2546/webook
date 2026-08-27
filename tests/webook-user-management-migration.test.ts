import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const sql = readFileSync(
  new URL("../supabase/migrations/20260827120000_webook_user_management.sql", import.meta.url),
  "utf8",
);
const atomicUpdateSql = readFileSync(
  new URL("../supabase/migrations/20260827150000_atomic_webook_user_update.sql", import.meta.url),
  "utf8",
);
const hardeningSql = readFileSync(
  new URL("../supabase/migrations/20260827180000_harden_webook_user_management.sql", import.meta.url),
  "utf8",
);

describe("Webook user management migration", () => {
  it("adds a durable Ban state and Role 1-only policies", () => {
    assert.match(sql, /add column if not exists is_banned boolean not null default false/);
    assert.match(sql, /create policy "Role 1 can manage Webook users"/);
    assert.match(sql, /where users\.role_id = 1/);
  });

  it("uses a security-definer helper to avoid recursive users RLS evaluation", () => {
    assert.match(sql, /create or replace function private\.is_webook_user_manager\(\)/);
    assert.match(sql, /using \(\(select private\.is_webook_user_manager\(\)\)\)/);
    assert.match(sql, /with check \(\(select private\.is_webook_user_manager\(\)\)\)/);
  });

  it("allows authenticated users to read only their current auth record", () => {
    assert.match(sql, /create policy "Authenticated users can read their own Webook user record"/);
    assert.match(sql, /for select\s+to authenticated\s+using \(\s*users\.uid = auth\.uid\(\)/);
    assert.match(sql, /users\.email = auth\.jwt\(\) ->> 'email'/);
  });

});

describe("Webook user atomic identity update migration", () => {
  it("serializes normalized identity checks before updating a user", () => {
    const usernameLock = atomicUpdateSql.indexOf("pg_advisory_xact_lock(hashtextextended('webook:username:'");
    const emailLock = atomicUpdateSql.indexOf("pg_advisory_xact_lock(hashtextextended('webook:email:'");
    const conflictCheck = atomicUpdateSql.indexOf("raise unique_violation");
    const update = atomicUpdateSql.indexOf("update public.users");

    assert.ok(usernameLock >= 0);
    assert.ok(emailLock > usernameLock);
    assert.ok(conflictCheck > emailLock);
    assert.ok(update > conflictCheck);
    assert.match(atomicUpdateSql, /lower\(btrim\(users\.email\)\) = lower\(btrim\(p_email\)\)/);
  });
});

describe("Webook user management hardening migration", () => {
  it("removes direct browser writes while preserving manager reads", () => {
    assert.match(hardeningSql, /drop policy if exists "Role 1 can manage Webook users"/);
    assert.match(hardeningSql, /drop policy if exists "Role 1 cannot update their own Webook user record"/);
    assert.match(hardeningSql, /create policy "Role 1 can read Webook users"[\s\S]*for select/);
    assert.match(hardeningSql, /revoke all on table public\.users from anon, authenticated/);
    assert.match(hardeningSql, /grant select on table public\.users to authenticated/);
    assert.doesNotMatch(hardeningSql, /for all\s+to authenticated/);
  });

  it("routes detail and Ban writes through service-role-only functions", () => {
    assert.match(
      hardeningSql,
      /create or replace function public\.update_webook_user_details[\s\S]*security definer/,
    );
    assert.match(
      hardeningSql,
      /create or replace function public\.set_webook_user_ban[\s\S]*security definer/,
    );
    assert.match(
      hardeningSql,
      /revoke all on function public\.update_webook_user_details[\s\S]*from public, anon, authenticated/,
    );
    assert.match(
      hardeningSql,
      /revoke all on function public\.set_webook_user_ban[\s\S]*from public, anon, authenticated/,
    );
    assert.match(hardeningSql, /grant execute on function public\.update_webook_user_details[\s\S]*to service_role/);
    assert.match(hardeningSql, /grant execute on function public\.set_webook_user_ban[\s\S]*to service_role/);
  });

  it("fences every lifecycle write with an atomic per-record database lease", () => {
    assert.match(hardeningSql, /create table if not exists private\.webook_user_lifecycle_locks/);
    assert.match(hardeningSql, /user_id uuid primary key/);
    assert.match(hardeningSql, /owner_token uuid not null/);
    assert.match(hardeningSql, /expires_at timestamptz not null/);
    assert.match(
      hardeningSql,
      /create or replace function public\.acquire_webook_user_lifecycle_lock[\s\S]*on conflict \(user_id\) do update[\s\S]*where current_lock\.expires_at <= now\(\)/,
    );
    assert.match(
      hardeningSql,
      /create or replace function public\.release_webook_user_lifecycle_lock[\s\S]*owner_token = p_owner_token/,
    );
    const ownershipChecks = hardeningSql.match(
      /from private\.webook_user_lifecycle_locks[\s\S]{0,300}owner_token = p_lock_token[\s\S]{0,300}expires_at > now\(\)/g,
    ) ?? [];
    assert.equal(ownershipChecks.length, 2);
  });
});
