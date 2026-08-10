import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getCentralUserBinding } from "../server/central-user-manager/cloudflare-bindings.ts";
import { listCentralUserTenants, resolveCentralUserTenant } from "../server/central-user-manager/tenant-bindings.ts";

const BAANPARTY_TENANT_ID = "a7f10ab9-db3a-400f-8185-03aabe8041db";
const POOLVILLAPATTAYA_TENANT_ID = "9fd7c645-563a-4cce-85ac-20ffb8f3bfc0";
const FLUK_NASA_POOLVILLA_TENANT_ID = "ce440408-3844-4a06-a5ae-56a4fac8acf8";
const VILLA_MEDIA_POOLVILLA_TENANT_ID = "f216699f-30cc-4076-822c-88657ca4efda";

describe("central user manager tenant bindings", () => {
  it("exposes only browser-safe metadata for the approved tenant registry", () => {
    assert.deepEqual(listCentralUserTenants(), [
      { key: "baanparty", displayName: "Baan Party Pattaya", environment: "Production", enabled: true },
      { key: "poolvillapattaya", displayName: "Poolvillapattaya", environment: "Production", enabled: true },
      { key: "baanpmhee", displayName: "baanPMhee", environment: "Production", enabled: true },
      { key: "fluknasapoolvilla", displayName: "Fluk Nasa Poolvilla", environment: "Production", enabled: true },
      { key: "villamediapoolvilla", displayName: "Villa Media Poolvilla", environment: "Production", enabled: true },
    ]);
  });

  it("resolves only an approved tenant key", () => {
    assert.deepEqual(resolveCentralUserTenant("baanparty"), { key: "baanparty", id: BAANPARTY_TENANT_ID, displayName: "Baan Party Pattaya", environment: "Production", enabled: true });
    assert.deepEqual(resolveCentralUserTenant("poolvillapattaya"), { key: "poolvillapattaya", id: POOLVILLAPATTAYA_TENANT_ID, displayName: "Poolvillapattaya", environment: "Production", enabled: true });
    assert.deepEqual(resolveCentralUserTenant("fluknasapoolvilla"), { key: "fluknasapoolvilla", id: FLUK_NASA_POOLVILLA_TENANT_ID, displayName: "Fluk Nasa Poolvilla", environment: "Production", enabled: true });
    assert.deepEqual(resolveCentralUserTenant("villamediapoolvilla"), { key: "villamediapoolvilla", id: VILLA_MEDIA_POOLVILLA_TENANT_ID, displayName: "Villa Media Poolvilla", environment: "Production", enabled: true });
    assert.equal(resolveCentralUserTenant("unknown"), null);
    assert.equal(resolveCentralUserTenant(BAANPARTY_TENANT_ID), null);
    assert.equal(resolveCentralUserTenant("not-a-uuid"), null);
  });

  it("returns the matching binding for each new tenant ID", async () => {
    const flukNasaBinding = { fetch: () => Promise.resolve(new Response()) };
    const villaMediaBinding = { fetch: () => Promise.resolve(new Response()) };
    const contextSymbol = Symbol.for("__cloudflare-context__");
    Reflect.set(globalThis, contextSymbol, { env: {
      CUM_FLUK_NASA_POOLVILLA: flukNasaBinding,
      CUM_VILLA_MEDIA_POOLVILLA: villaMediaBinding,
    } });

    try {
      assert.equal(await getCentralUserBinding(FLUK_NASA_POOLVILLA_TENANT_ID), flukNasaBinding);
      assert.equal(await getCentralUserBinding(VILLA_MEDIA_POOLVILLA_TENANT_ID), villaMediaBinding);
    } finally {
      Reflect.deleteProperty(globalThis, contextSymbol);
    }
  });
});
