import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("auth UI", () => {
  it("disables browser autocomplete on auth forms and inputs", () => {
    const loginPage = readFileSync(new URL("../app/login/page.tsx", import.meta.url), "utf8");
    const resetRequestForm = readFileSync(
      new URL("../app/login/password-reset-request-form.tsx", import.meta.url),
      "utf8",
    );
    const resetPasswordPage = readFileSync(new URL("../app/login/reset-password/page.tsx", import.meta.url), "utf8");

    for (const source of [loginPage, resetRequestForm, resetPasswordPage]) {
      assert.match(source, /<form[\s\S]*autoComplete="off"/);
      assert.doesNotMatch(source, /autoComplete="(?:email|username|current-password)"/);
    }

    assert.doesNotMatch(loginPage, /name="password"/);
    assert.match(loginPage, /name="adminCredential"/);
    assert.match(loginPage, /data-lpignore="true"/);
    assert.match(loginPage, /data-1p-ignore="true"/);
    assert.match(loginPage, /data-bwignore="true"/);
    assert.match(resetPasswordPage, /name="newAdminCredential"/);
    assert.match(resetPasswordPage, /name="confirmAdminCredential"/);
  });
});
