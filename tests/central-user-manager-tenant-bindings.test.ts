import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { listCentralUserTenants, resolveCentralUserTenant } from "../server/central-user-manager/tenant-bindings.ts";

const BAANPARTY_TENANT_ID = "a7f10ab9-db3a-400f-8185-03aabe8041db";

describe("central user manager tenant bindings", () => {
  it("exposes only browser-safe metadata for the approved tenant registry", () => {
    assert.deepEqual(listCentralUserTenants(), [{ key: "baanparty", displayName: "Baan Party Pattaya", environment: "Production", enabled: true }]);
  });

  it("resolves only an approved tenant key", () => {
    assert.deepEqual(resolveCentralUserTenant("baanparty"), { key: "baanparty", id: BAANPARTY_TENANT_ID, displayName: "Baan Party Pattaya", environment: "Production", enabled: true });
    assert.equal(resolveCentralUserTenant("unknown"), null);
    assert.equal(resolveCentralUserTenant(BAANPARTY_TENANT_ID), null);
    assert.equal(resolveCentralUserTenant("not-a-uuid"), null);
  });

  it("uses a fixed typed binding without dynamic environment selection", () => {
    const source = readFileSync(new URL("../server/central-user-manager/cloudflare-bindings.ts", import.meta.url), "utf8");
    const registrySource = readFileSync(new URL("../server/central-user-manager/tenant-bindings.ts", import.meta.url), "utf8");
    assert.match(registrySource, /import "server-only"/);
    assert.match(source, /env\.CUM_BAANPARTY/);
    assert.doesNotMatch(source, /env\s*\[/);
    assert.doesNotMatch(source, /fetch\s*\(/);
  });
});
