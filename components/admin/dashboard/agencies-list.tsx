import { Table, TableBody, TableHead, TableHeader, TableRow } from "../../ui/table";
import { dashboardAgencyDetailHref, dashboardAgenciesHref } from "../../../lib/dashboard-routes";
import type { DashboardAgenciesQuery, DashboardReport } from "../../../lib/dashboard";
import { DashboardAgencyRow, DashboardAgencyTableRow } from "./dashboard-rows";
import { DashboardPager } from "./dashboard-list-primitives";
import { DashboardAgencyFilters } from "./dashboard-agency-filters";

export function AgenciesList({ report, query }: { report: DashboardReport; query: DashboardAgenciesQuery }) {
  if (!report.admin) return null;
  const page = report.admin.agencies;
  return <section>
    <DashboardAgencyFilters query={query} />
    {page.total === 0 ? <div className="overflow-hidden rounded-xl border"><p role="status" className="px-4 py-6 text-sm text-muted-foreground">{report.overview.agencyCount === 0 ? "ไม่มียอดขายติดจองในเดือนนี้" : "ไม่พบเอเจนซี่ที่ตรงกับตัวกรอง"}</p></div> : <>
      <div className="hidden overflow-hidden rounded-xl border md:block"><Table className="table-fixed"><TableHeader><TableRow><TableHead className="w-[55%]">ชื่อเอเจนซี่</TableHead><TableHead className="w-[20%] text-right">จำนวนการจองติดจอง</TableHead><TableHead className="w-[25%] text-right">ยอดขาย</TableHead></TableRow></TableHeader><TableBody>{page.rows.map(row => <DashboardAgencyTableRow key={row.id ?? "unassigned"} agency={row} href={dashboardAgencyDetailHref(query, row.id ?? "unassigned")} />)}</TableBody></Table></div>
      <div className="space-y-3 md:hidden">{page.rows.map(row => <DashboardAgencyRow key={row.id ?? "unassigned"} agency={row} href={dashboardAgencyDetailHref(query, row.id ?? "unassigned")} />)}</div>
    </>}
    <div className="mt-4"><DashboardPager {...page} href={pageNumber => dashboardAgenciesHref(query, { page: pageNumber })} /></div>
  </section>;
}
