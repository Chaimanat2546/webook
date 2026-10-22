"use client";

import type { DashboardAgenciesQuery } from "../../../lib/dashboard";
import { DashboardMobileListControls, DashboardMobileListResults } from "./dashboard-mobile-list-controls";

export function DashboardAgencyMobileControls({ query }: { query: DashboardAgenciesQuery }) {
  return <DashboardMobileListControls query={query} kind="agencies" />;
}
export function DashboardAgencyMobileResults({ query, total }: { query: DashboardAgenciesQuery; total: number }) {
  return <DashboardMobileListResults query={query} total={total} kind="agencies" />;
}
