import assert from "node:assert/strict";
import { test } from "node:test";
import { requireWebsiteAnalyticsAccess } from "../server/auth/website-analytics.ts";
import { handleWebsiteAnalyticsRequest } from "../server/site-analytics/route.ts";
import { WebsiteAnalyticsError, type WebsiteAnalyticsReport } from "../lib/website-analytics.ts";
import { sites, period } from "./fixtures/website-analytics.ts";
test("analytics authorization requires verified uid and admin scope", async () => {
  await assert.rejects(requireWebsiteAnalyticsAccess({ identity: async () => null, access: async () => { throw Error("must not query"); } }), /unauthenticated/);
  await assert.rejects(requireWebsiteAnalyticsAccess({ identity: async () => "uid", access: async uid => { assert.equal(uid, "uid"); return { kind: "owner", propertyId: "9" }; } }), /forbidden/);
  await requireWebsiteAnalyticsAccess({ identity: async () => "uid", access: async () => ({ kind: "admin" }) });
  await assert.rejects(requireWebsiteAnalyticsAccess({ identity: async () => "uid", access: async () => { throw Error("database-secret"); } }), /unavailable/);
});
test("API returns safe errors before any upstream fetch and rejects repeated filters", async () => {
  for (const status of [401, 403, 503]) {
    const response = await handleWebsiteAnalyticsRequest(new Request("https://webook.test/api/admin/website-analytics"), { authorize: async () => { throw new WebsiteAnalyticsError("access_denied", status); }, load: async () => { throw Error("must not fetch"); } });
    assert.equal(response.status, status); assert.equal(response.headers.get("cache-control"), "private, no-store");
  }
  for (const search of ["?site=evil", "?month=2026-10&month=2026-09", "?url=https://evil.test"]) {
    const r = await handleWebsiteAnalyticsRequest(new Request(`https://webook.test/api/admin/website-analytics${search}`), { authorize: async () => {}, sites: () => sites, now: () => new Date(period.as_of), load: async () => { throw Error("must not fetch"); } });
    assert.equal(r.status, 400);
  }
});
test("API distinguishes partial 200 and unavailable 503", async () => {
  for (const status of ["partial", "unavailable"] as const) {
    const report = { status } as WebsiteAnalyticsReport;
    const response = await handleWebsiteAnalyticsRequest(new Request("https://webook.test/api/admin/website-analytics"), { authorize: async () => {}, sites: () => sites, now: () => new Date(period.as_of), load: async () => report });
    assert.equal(response.status, status === "partial" ? 200 : 503);
    assert.deepEqual(await response.json(), report);
  }
  const failed = await handleWebsiteAnalyticsRequest(new Request("https://webook.test/api/admin/website-analytics"), { authorize: async () => { throw Error("secret"); } });
  assert.equal(failed.status, 503); assert.doesNotMatch(await failed.text(), /secret/);
});
