import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";

test("offline notice announces loss of connectivity without a reload control or online success claim", () => {
  const result = JSON.parse(execFileSync(process.execPath, [
    "--loader", "./tests/tsx-loader.mjs", "./tests/fixtures/pwa-connection-ui.mjs",
  ], { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })) as { offline: string; online: string; error: string };
  assert.match(result.offline, /role="status"/);
  assert.match(result.offline, /ออฟไลน์/);
  assert.doesNotMatch(result.offline, /<button|<a /);
  assert.equal(result.online, "");
  assert.match(result.error, /<button[^>]*type="button"/);
  assert.match(result.error, /ลองโหลดอีกครั้ง/);
  assert.doesNotMatch(result.error, /private server details/);
});
