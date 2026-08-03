import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
  new URL("../app/admin/user-manager/actions.ts", import.meta.url),
  "utf8",
);

describe("central user manager actions", () => {
  it("resolves the browser tenant key on the server", () => {
    assert.match(source, /resolveCentralUserTenant\(readString\(formData, "tenantKey"\)\)/);
    assert.match(source, /if \(!tenant \|\| !tenant\.enabled\)/);
    assert.match(source, /tenantId: tenant\.id/);
    assert.doesNotMatch(source, /STAGING_TENANT_ID/);
  });
});
