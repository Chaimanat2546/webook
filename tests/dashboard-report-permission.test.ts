import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { dashboardReportScope, dashboardScope } from "../lib/dashboard.ts";
import { createDashboardRepository } from "../server/repositories/dashboard.ts";
import { DashboardForbidden, loadDashboard, loadDashboardBookingCustomer } from "../server/services/dashboard.ts";

test("report permission requires literal true for owners while admins retain access", () => {
  assert.deepEqual(dashboardReportScope({ role_id: 1, dv_id: null, allow_tools: null }), { kind: "admin" });
  assert.deepEqual(dashboardReportScope({ role_id: 3, dv_id: "2237", allow_tools: { allow_report: true } }), { kind: "owner", propertyId: "2237" });
  for (const allow_tools of [null, undefined, {}, [], true, { allow_report: false }, { allow_report: "true" }, { allow_report: 1 }, { allow_booking: true }]) {
    assert.equal(dashboardReportScope({ role_id: 3, dv_id: "2237", allow_tools }), null);
  }
  assert.equal(dashboardReportScope({ role_id: 3, dv_id: null, allow_tools: { allow_report: true } }), null);
  assert.equal(dashboardReportScope(null), null);
  assert.deepEqual(dashboardScope({ role_id: 3, dv_id: "2237" }), { kind: "owner", propertyId: "2237" }, "ownership-only notification checks remain independent of report permission");
});

test("revoked report permission blocks report and customer loaders before privileged reads", async () => {
  let enabled = true;
  const reads: string[] = [];
  const client = createClient("https://example.supabase.co", "test-key", { global: { fetch: async (input, init) => {
    const url = new URL(new Request(input, init).url);
    reads.push(url.pathname);
    assert.equal(url.pathname, "/rest/v1/users");
    assert.equal(url.searchParams.get("uid"), "eq.owner");
    assert.equal(url.searchParams.get("select"), "role_id,dv_id,allow_tools");
    return Response.json({ role_id: 3, dv_id: "2237", allow_tools: { allow_report: enabled } });
  } } });
  const repository = createDashboardRepository(client);
  assert.deepEqual(await repository.access("owner"), { kind: "owner", propertyId: "2237" });
  enabled = false;
  assert.equal(await repository.access("owner"), null);
  await assert.rejects(loadDashboard(repository, "owner", { month: "2026-10", allow_report: true }), DashboardForbidden);
  await assert.rejects(loadDashboardBookingCustomer(repository, "owner", "1"), DashboardForbidden);
  assert.deepEqual(reads, Array(4).fill("/rest/v1/users"));
});
