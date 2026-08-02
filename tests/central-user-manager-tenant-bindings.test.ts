import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { listCentralUserTenants, resolveCentralUserTenant, STAGING_TENANT_ID } from "../server/central-user-manager/tenant-bindings.ts";

describe("central user manager tenant bindings", () => {
  it("exposes only browser-safe metadata for the approved tenant registry", () => {
    assert.deepEqual(listCentralUserTenants(), [{ key: "baan-pool-villa-staging", displayName: "Baan Pool Villa", environment: "Staging", enabled: true }]);
  });

  it("resolves only an approved tenant key", () => {
    assert.deepEqual(resolveCentralUserTenant("baan-pool-villa-staging"), { key: "baan-pool-villa-staging", id: STAGING_TENANT_ID, displayName: "Baan Pool Villa", environment: "Staging", enabled: true });
    assert.equal(resolveCentralUserTenant("unknown"), null);
    assert.equal(resolveCentralUserTenant(STAGING_TENANT_ID), null);
    assert.equal(resolveCentralUserTenant("not-a-uuid"), null);
  });

  it("uses a fixed typed binding without dynamic environment selection", () => {
    const source = readFileSync(new URL("../server/central-user-manager/cloudflare-bindings.ts", import.meta.url), "utf8");
    const registrySource = readFileSync(new URL("../server/central-user-manager/tenant-bindings.ts", import.meta.url), "utf8");
    assert.match(registrySource, /import "server-only"/);
    assert.match(source, /env\.CUM_BAAN_POOL_VILLA_STAGING/);
    assert.doesNotMatch(source, /env\s*\[/);
    assert.doesNotMatch(source, /fetch\s*\(/);
  });
});
