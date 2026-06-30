import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizePasswordResetEmail,
  passwordResetMessages,
  validateNewPassword,
  validatePasswordResetEmail,
} from "../lib/auth/password-reset.ts";
import { getPasswordResetCooldownSeconds } from "../lib/auth/password-reset-cooldown.ts";
import {
  clearPasswordResetRateLimitForTests,
  consumePasswordResetRateLimit,
} from "../server/auth/password-reset-rate-limit.ts";

describe("password reset validation", () => {
  it("normalizes and validates email input", () => {
    assert.equal(normalizePasswordResetEmail("  Admin@Example.COM  "), "admin@example.com");
    assert.equal(validatePasswordResetEmail(""), passwordResetMessages.emailRequired);
    assert.equal(validatePasswordResetEmail("admin"), passwordResetMessages.emailInvalid);
    assert.equal(validatePasswordResetEmail("admin@example.com"), null);
  });

  it("returns Thai password validation messages for each failed rule", () => {
    assert.deepEqual(validateNewPassword({ confirmPassword: "", password: "" }), [
      passwordResetMessages.passwordRequired,
      passwordResetMessages.confirmRequired,
    ]);
    assert.deepEqual(validateNewPassword({ confirmPassword: "short", password: "short" }), [
      passwordResetMessages.passwordTooShort,
      passwordResetMessages.passwordNeedsUppercase,
      passwordResetMessages.passwordNeedsNumber,
      passwordResetMessages.passwordNeedsSymbol,
    ]);
    assert.deepEqual(validateNewPassword({ confirmPassword: "NOLOWER1!", password: "NOLOWER1!" }), [
      passwordResetMessages.passwordNeedsLowercase,
    ]);
    assert.deepEqual(validateNewPassword({ confirmPassword: "NoNumber!", password: "NoNumber!" }), [
      passwordResetMessages.passwordNeedsNumber,
    ]);
    assert.deepEqual(
      validateNewPassword({ confirmPassword: "Different123!", password: "Valid123!" }),
      [passwordResetMessages.passwordMismatch],
    );
    assert.deepEqual(validateNewPassword({ confirmPassword: "Valid123!", password: "Valid123!" }), []);
  });

  it("rate limits reset requests per email key", () => {
    clearPasswordResetRateLimitForTests();

    assert.equal(consumePasswordResetRateLimit("admin@example.com", 1000), true);
    assert.equal(consumePasswordResetRateLimit("admin@example.com", 1001), false);
    assert.equal(consumePasswordResetRateLimit("other@example.com", 1004), true);
    assert.equal(consumePasswordResetRateLimit("admin@example.com", 61_001), true);
  });

  it("rounds reset request cooldown up to the next visible second", () => {
    assert.equal(getPasswordResetCooldownSeconds(61_000, 1_001), 60);
    assert.equal(getPasswordResetCooldownSeconds(61_000, 60_999), 1);
    assert.equal(getPasswordResetCooldownSeconds(61_000, 61_000), 0);
    assert.equal(getPasswordResetCooldownSeconds(61_000, 62_000), 0);
  });
});
