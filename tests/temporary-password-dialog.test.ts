import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const dialog = readFileSync(
  new URL(
    "../components/admin/user-manager/temporary-password-dialog.tsx",
    import.meta.url,
  ),
  "utf8",
);
const hook = readFileSync(
  new URL(
    "../components/admin/user-manager/use-user-manager.ts",
    import.meta.url,
  ),
  "utf8",
);

describe("temporary password dialog", () => {
  it("keeps the password in memory and clears it on close or acknowledgement", () => {
    assert.match(dialog, /navigator\.clipboard\.writeText/);
    assert.match(dialog, /คัดลอกไม่สำเร็จ/);
    assert.match(dialog, /onAcknowledge/);
    assert.match(hook, /setTemporaryCredential\(null\)/);
    assert.doesNotMatch(
      `${dialog}\n${hook}`,
      /localStorage|sessionStorage|URLSearchParams|console\.|toast\([^)]*password/i,
    );
  });

  it("renders password content only while a non-null value is supplied", () => {
    assert.match(dialog, /password === null/);
    assert.match(dialog, /return null/);
    assert.match(dialog, /aria-label="รหัสผ่านชั่วคราว"/);
    assert.match(dialog, /email/);
    assert.match(dialog, /ไม่สามารถเรียกดูรหัสเดิมได้/);
  });
});
