import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyMetrics } from "../lib/website-analytics.ts";
import { visibleWebsitePeriodRows, websiteMultiPeriodPoints, websitePeriodRows } from "../lib/website-analytics-comparison.ts";

test("one hidden website removes both periods while retaining true zeroes and source totals", () => {
  const range = { from: "2026-10-08", to: "2026-10-08" };
  const previousRange = { from: "2026-10-07", to: "2026-10-07" };
  const make = (key: string, date: string, views: number) => ({ key, displayName: key, origin: `https://${key}.test`, status: "complete" as const, coverage: { data_available_from: "2026-01-01T00:00:00Z", range_complete: true, rows_complete: true }, totals: { ...emptyMetrics(), page_views: views }, daily: [{ ...emptyMetrics(), date, page_views: views }] });
  const rows = websitePeriodRows([make("a", range.from, 30), make("b", range.from, 0)], range, { granularity: "day", range: previousRange, sites: [make("a", previousRange.from, 20), make("b", previousRange.from, 10)] }, "2026-10-15T03:00:00Z", "page_views", "day");
  const visible = visibleWebsitePeriodRows(rows, ["a"]);
  assert.deepEqual(visible.map(row => [row.key, row.currentSelected, row.previousSelected, row.current.total, row.previous.total]), [["b", true, true, 0, 10]]);
  assert.deepEqual(websiteMultiPeriodPoints(visible)[0].values, { b: { current: 0, previous: 10 } });
  assert.equal(rows[0].current.total, 30, "visibility must not mutate source totals");
  const restored = visibleWebsitePeriodRows(rows, []);
  assert.equal(restored[0].current.total, 30, "showing again restores the primary values");
  assert.equal(restored[0].previous.total, 20, "showing again restores the comparison values");
});
