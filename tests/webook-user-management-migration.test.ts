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
});
