import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("auth UI", () => {
  it("keeps the existing password recovery autocomplete behavior", () => {
    const resetRequestForm = readFileSync(
      new URL("../app/login/password-reset-request-form.tsx", import.meta.url),
      "utf8",
    );
    const resetPasswordPage = readFileSync(new URL("../app/login/reset-password/page.tsx", import.meta.url), "utf8");

    for (const source of [resetRequestForm, resetPasswordPage]) {
      assert.match(source, /<form[\s\S]*autoComplete="off"/);
      assert.doesNotMatch(source, /autoComplete="(?:email|username|current-password)"/);
    }

    assert.match(resetPasswordPage, /name="newAdminCredential"/);
    assert.match(resetPasswordPage, /name="confirmAdminCredential"/);
  });

});
