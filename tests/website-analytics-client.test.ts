import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchSiteReport } from "../server/site-analytics/client.ts";
import { parseSourceReport } from "../server/site-analytics/report.ts";
import { listAnalyticsSites } from "../server/site-analytics/registry.ts";
import { sites, source, period } from "./fixtures/website-analytics.ts";

test("registry keeps canonical origins and source identities", () => {
  for (const site of sites) assert.deepEqual(listAnalyticsSites().find(s => s.key === site.key)?.origin, site.origin);
});
test("source report validates identity, metrics, coverage and reconciliation", () => {
  assert.equal(parseSourceReport(source(), sites[0], period).totals.contact_clicks, 5);
  const mutations: ((value: ReturnType<typeof source>) => void)[] = [
    v => { v.site_id = sites[1].siteId; }, v => { v.contract_version = "2.0"; },
    v => { v.query = { ...period, to_date: "2026-10-02" }; },
    v => { v.totals = { ...v.totals, page_views: -1 }; },
    v => { v.totals = { ...v.totals, page_views: Number.MAX_SAFE_INTEGER + 1 }; },
    v => { v.daily.push(v.daily[0]); }, v => { v.daily = []; },
    v => { v.daily[0].date = "2026-10-02"; }, v => { v.villas.push(v.villas[0]); },
    v => { v.coverage.data_available_from = "invalid"; },
    v => { v.coverage.data_available_from = "2026-10-01T01:00:00Z"; },
    v => { v.daily[0].page_views = 99; }, v => { v.villas[0].line_clicks = 99; },
  ];
  for (const mutate of mutations) { const value = structuredClone(source()); mutate(value); assert.throws(() => parseSourceReport(value, sites[0], period)); }
});
test("client posts only to allowlisted endpoint with server token", async () => {
  let calls = 0;
  const result = await fetchSiteReport(sites[0], period, { token: async () => "fixture-secret", fetch: async (input, init) => {
    calls++; assert.equal(String(input), "https://nasapoolvilla.com/api/analytics/v1/report");
    assert.equal(init?.redirect, "manual"); assert.equal(init?.cache, "no-store");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer fixture-secret");
    assert.deepEqual(JSON.parse(String(init?.body)), period);
    return Response.json(source());
  } });
  assert.equal(calls, 1); assert.equal(result.ok, true); assert.doesNotMatch(JSON.stringify(result), /fixture-secret/);
  const missing = await fetchSiteReport(sites[0], period, { token: async () => null, fetch: async () => { throw Error("must not fetch"); } });
  assert.deepEqual(missing, { ok: false, reason: "not_configured" });
  const invalid = await fetchSiteReport({ ...sites[0], origin: "https://evil.test" }, period, { token: async () => { throw Error("must not read secret"); } });
  assert.equal(invalid.ok, false);
});
test("client sanitizes failures and bounds body and timeout", async () => {
  for (const [status, reason] of [[401, "unauthorized"], [403, "unauthorized"], [429, "rate_limited"], [503, "unavailable"], [302, "unavailable"]] as const) {
    assert.deepEqual(await fetchSiteReport(sites[0], period, { token: async () => "secret", fetch: async () => new Response("secret", { status }) }), { ok: false, reason });
  }
  for (const body of ["not JSON", "x".repeat(3 * 1024 * 1024 + 1)]) {
    assert.deepEqual(await fetchSiteReport(sites[0], period, { token: async () => "secret", fetch: async () => new Response(body) }), { ok: false, reason: "invalid_report" });
  }
  const result = await fetchSiteReport(sites[0], period, { token: async () => "secret", timeoutMs: 10, fetch: async (_url, init) => new Response(new ReadableStream({ start(controller) { init?.signal?.addEventListener("abort", () => controller.error(new Error("aborted"))); } })) });
  assert.deepEqual(result, { ok: false, reason: "timeout" });
});
