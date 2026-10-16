import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SitePeriodComparison } from "../../components/admin/dashboard/website-analytics/site-period-comparison.tsx";
import { WebsitePeriodDetailChart } from "../../components/admin/dashboard/website-analytics/website-period-detail-chart.tsx";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime.js";
import { WebsiteSiteSummary } from "../../components/admin/dashboard/website-analytics/site-summary.tsx";
import { WebsiteAnalyticsView } from "../../components/admin/dashboard/website-analytics/view.tsx";
import { WebsiteDatasetControls } from "../../components/admin/dashboard/website-analytics/dataset-controls.tsx";
import { emptyMetrics } from "../../lib/website-analytics.ts";
import { websitePeriodSeries } from "../../lib/website-analytics-comparison.ts";
import { PeriodComparisonDetails, PeriodLegend } from "../../components/admin/dashboard/website-analytics/period-comparison-summary.tsx";

const range = { from: "2026-10-08", to: "2026-10-09" };
const priorRange = { from: "2026-10-06", to: "2026-10-07" };
function site(key, total, selectedRange, status = "complete") {
  return { key, displayName: `Website ${key}`, origin: `https://${key}.test`, status,
    coverage: { data_available_from: "2026-01-01T00:00:00Z", range_complete: status === "complete", rows_complete: true },
    totals: total === null ? null : { ...emptyMetrics(), page_views: total },
    daily: total === null ? [] : [{ ...emptyMetrics(), date: selectedRange.from, page_views: total }, { ...emptyMetrics(), date: selectedRange.to }] };
}
const current = site("a", 30, range), prior = site("a", 20, priorRange);
function render(sites, previousSites, view, asOf = "2026-10-10T03:00:00Z") {
  if (view === "total") return overview(sites, previousSites, view, asOf);
  const report = { period: { from_date: range.from, to_date: range.to, as_of: asOf, timezone: "Asia/Bangkok", contract_version: "1.0", villa_id: null },
    status: "complete", selectedSites: sites.length, availableSites: sites.filter(site => site.totals).length, totals: sites[0]?.totals ?? null, unattributed: emptyMetrics(),
    websites: sites, daily: sites[0]?.daily ?? [], villas: { rows: [], total: 0, page: 1, pageSize: 10 } };
  const query = { month: "2026-10", ...range, site: sites[0]?.key, page: 1 };
  return renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: { push() {}, replace() {} } },
    React.createElement(WebsitePeriodDetailChart, { report, query, compare: view !== "normalHidden", previous: view === "normalHidden" ? undefined : { granularity: "day", range: priorRange, sites: previousSites }, ...(view === "normalHidden" ? { sites: [{ key: "a", displayName: "Website a" }, { key: "b", displayName: "Website b" }], scope: { sites: ["b"] } } : {}) })));
}
function overview(sites, previousSites, view = "daily", asOf = "2026-10-10T03:00:00Z") {
  return renderToStaticMarkup(React.createElement(SitePeriodComparison, { granularity: "day", sites, range, previous: { granularity: "day", range: priorRange, sites: previousSites }, view, asOf, metric: "page_views", hiddenSites: [], onToggleSite() {} }));
}
function details(currentSite, previousSite, asOf = "2026-10-10T03:00:00Z") {
  return renderToStaticMarkup(React.createElement(PeriodComparisonDetails, {
    current: websitePeriodSeries(currentSite, range, asOf, "page_views", "day"),
    previous: websitePeriodSeries(previousSite, priorRange, asOf, "page_views", "day"),
  }));
}
function summary(previous) {
  return renderToStaticMarkup(React.createElement(WebsiteSiteSummary, { granularity: "day", sites: [current, site("b", 12, range, "partial")], month: "2026-10", range, compare: true,
    asOf: "2026-10-10T03:00:00Z", previous }));
}
function navigation(view) {
  const report = { period: { from_date: range.from, to_date: range.to, as_of: "2026-10-10T03:00:00Z" }, status: "complete", selectedSites: 1, availableSites: 1,
    totals: current.totals, websites: [{ ...current, unattributed: emptyMetrics(), villas: { rows: [], total: 21, page: 1 } }], daily: current.daily };
  return renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: { push() {}, replace() {} } },
    React.createElement(WebsiteAnalyticsView, { report, query: { month: "2026-10", ...range, site: "a", page: 1, view }, sites: [{ key: "a", displayName: "Website a" }], compare: true })));
}
console.log(JSON.stringify({
  yearLegend: renderToStaticMarkup(React.createElement(PeriodLegend, { currentRange: range, previousRange: { from: "2025-10-08", to: "2025-10-09" } })),
  normalControls: renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: { push() {}, replace() {} } }, React.createElement(WebsiteDatasetControls, { range, today: "2026-10-10", sites: [{ key: "a", displayName: "Website a" }, { key: "b", displayName: "Website b" }] }))),
  comparisonControls: renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: { push() {}, replace() {} } }, React.createElement(WebsiteDatasetControls, { range, today: "2026-10-10", sites: [{ key: "a", displayName: "Website a" }, { key: "b", displayName: "Website b" }], comparison: { ...priorRange, sites: ["a", "b"] } }))),
  crossSites: overview([current], [site("b", 10, priorRange)]),
  complete: render([current], [prior], "daily"),
  hiddenNormalDetail: render([current], [prior], "normalHidden"),
  partial: render([current], [{ ...prior, status: "partial", daily: prior.daily.slice(0, 1) }], "daily"),
  partialDetails: details(current, { ...prior, status: "partial", daily: prior.daily.slice(0, 1) }),
  failed: render([current], [site("a", null, priorRange, "timeout")], "daily"),
  zero: render([current], [site("a", 0, priorRange)], "daily"),
  ongoing: render([current], [prior], "daily", "2026-10-09T03:00:00Z"),
  ongoingPartial: render([{ ...current, status: "partial", coverage: { ...current.coverage, rows_complete: false } }], [prior], "daily", "2026-10-09T03:00:00Z"),
  ongoingPartialDetails: details({ ...current, status: "partial", coverage: { ...current.coverage, rows_complete: false } }, prior, "2026-10-09T03:00:00Z"),
  total: render([current, site("b", 12, range)], [prior, site("b", null, priorRange, "timeout")], "total"),
  unselectedPartial: summary({ granularity: "day", range: priorRange, sites: [prior, site("b", 10, priorRange)] }),
  fallbackPartial: summary(undefined),
  overview: overview([current, site("b", 12, range)], [prior, site("b", 10, priorRange)]),
  detailNavigation: navigation(undefined),
  listNavigation: navigation("houses"),
}));
