import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getContentSecurityPolicy } from "../lib/security-headers.ts";

describe("content security policy", () => {
  it("allows Next.js development tooling without weakening production", () => {
    assert.match(getContentSecurityPolicy("development"), /script-src[^;]*'unsafe-eval'/);
    assert.doesNotMatch(getContentSecurityPolicy("production"), /script-src[^;]*'unsafe-eval'/);
  });
});
