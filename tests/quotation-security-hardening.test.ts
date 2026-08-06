import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260806121500_complete_quotation_security_hardening.sql",
  "utf8",
);
const nextConfig = readFileSync("next.config.ts", "utf8");

describe("quotation security hardening completion", () => {
  it("retires legacy public links and requires an expiry for future reads", () => {
    assert.match(migration, /retires every link without an expiry/);
    assert.match(migration, /and q\.public_token_expires_at > now\(\)/);
    assert.doesNotMatch(migration, /public_token_expires_at is null or/);
  });

  it("requires quotation permission when reading templates and revisions", () => {
    assert.equal((migration.match(/private\.has_quotation_permission\(\)/g) ?? []).length, 2);
    assert.match(migration, /Quotation users read owned document templates[\s\S]*user_id = \(select auth\.uid\(\)\)/);
    assert.match(migration, /Quotation users read owned document template revisions[\s\S]*template\.user_id = \(select auth\.uid\(\)\)/);
  });

  it("sets the browser security headers without advertising Next.js", () => {
    assert.match(nextConfig, /poweredByHeader: false/);
    assert.match(nextConfig, /Content-Security-Policy/);
    assert.match(nextConfig, /frame-ancestors 'self'/);
    assert.match(nextConfig, /X-Content-Type-Options/);
    assert.match(nextConfig, /X-Frame-Options/);
    assert.match(nextConfig, /Referrer-Policy/);
  });
});
