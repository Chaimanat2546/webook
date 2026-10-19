import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

for (const file of ["dashboard-migration.test.ts", "house-booking-database.test.ts", "ical-database.test.ts"]) {
  test(`${file} waits for final TCP PostgreSQL and fails closed on startup timeout`, () => {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    const readiness = source.slice(source.indexOf("let ready = false"), source.indexOf("let ready = false") + 650);
    assert.match(readiness, /['"]pg_isready['"],\s*['"]-h['"],\s*['"]127\.0\.0\.1['"]/);
    assert.match(readiness, /['"]-t['"],\s*['"]1['"]/);
    assert.match(readiness, /ready = true;\s*break;/);
    assert.match(readiness, /assert\.ok\(ready/);
    assert.doesNotMatch(readiness.slice(0, readiness.indexOf("assert.ok(ready")), /sql\(/);
  });
}
