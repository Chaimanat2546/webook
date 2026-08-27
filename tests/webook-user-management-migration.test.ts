import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const sql = readFileSync(
  new URL("../supabase/migrations/20260827120000_webook_user_management.sql", import.meta.url),
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

  it("prevents Role 1 users from updating their own record", () => {
    assert.match(sql, /create policy "Role 1 cannot update their own Webook user record"/);
    assert.match(sql, /as restrictive\s+for update\s+to authenticated/);
    assert.match(sql, /users\.uid is distinct from auth\.uid\(\)/);
    assert.match(sql, /users\.email is distinct from auth\.jwt\(\) ->> 'email'/);
  });
});
