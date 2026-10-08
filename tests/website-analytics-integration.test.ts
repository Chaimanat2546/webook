import assert from "node:assert/strict";
import { test } from "node:test";
import { handleWebsiteAnalyticsRequest } from "../server/site-analytics/route.ts";
import { loadWebsiteAnalytics } from "../server/services/website-analytics.ts";
import { fetchSiteReport } from "../server/site-analytics/client.ts";
import { requireWebsiteAnalyticsAccess } from "../server/auth/website-analytics.ts";
import { sites, source, period } from "./fixtures/website-analytics.ts";

test("authorized API aggregates two validated source reports and preserves a failed site", async () => {
  let failing = false;
  const calls: string[] = [];
  const dependencies = {
    authorize: () => requireWebsiteAnalyticsAccess({ identity: async () => "fixture-uid", access: async () => ({ kind: "admin" }) }),
    sites: () => sites, now: () => new Date(period.as_of),
    load: (query: Parameters<typeof loadWebsiteAnalytics>[0], now: Date) => loadWebsiteAnalytics(query, { now: () => now, sites: () => sites, read: (site, requestedPeriod) => fetchSiteReport(site, requestedPeriod, {
      token: async () => "fixture-only-token",
      fetch: async input => { calls.push(String(input)); return failing && site.key === sites[1].key ? new Response(null, { status: 503 }) : Response.json(source(site, requestedPeriod)); },
    }) }),
  };
  const response = await handleWebsiteAnalyticsRequest(new Request("https://webook.test/api/admin/website-analytics?month=2026-10"), dependencies);
  const complete = await response.json();
  assert.equal(complete.totals.page_views, 8); assert.equal(complete.totals.contact_clicks, 10);
  assert.equal(complete.status, "complete"); assert.equal(calls.length, 2);
  assert.doesNotMatch(JSON.stringify(complete), /fixture-only-token/);
  failing = true;
  const partial = await (await handleWebsiteAnalyticsRequest(new Request("https://webook.test/api/admin/website-analytics?page=2"), dependencies)).json();
  assert.equal(partial.status, "partial"); assert.equal(partial.totals.page_views, 4);
  assert.equal(partial.websites[1].status, "unavailable"); assert.equal(partial.villas.page, 1);
});
