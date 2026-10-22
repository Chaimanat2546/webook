import { Table, TableBody, TableHead, TableHeader, TableRow } from "../../ui/table";
import { dashboardAgencyDetailHref, dashboardAgenciesHref } from "../../../lib/dashboard-routes";
import type { DashboardAgenciesQuery, DashboardReport } from "../../../lib/dashboard";
import { DashboardAgencyRow, DashboardAgencyTableRow } from "./dashboard-rows";
import { DashboardMobilePager, DashboardPager } from "./dashboard-list-primitives";
import { DashboardAgencyMobileControls, DashboardAgencyMobileResults } from "./dashboard-agency-mobile-controls";
import { DashboardAgencyFilters } from "./dashboard-agency-filters";

export function AgenciesList({ report, query, mobileRedesign = false }: { report: DashboardReport; query: DashboardAgenciesQuery; mobileRedesign?: boolean }) {
  if (!report.admin) return null;
  const page = report.admin.agencies;
  return <section>
    <div className={mobileRedesign ? "hidden md:block" : undefined}><DashboardAgencyFilters query={query} /></div>
    {mobileRedesign && <><DashboardAgencyMobileControls key={JSON.stringify(query)} query={query} /><DashboardAgencyMobileResults query={query} total={page.total} /></>}
    {page.total === 0 ? <div className="overflow-hidden rounded-xl border border-border/70 bg-card"><p role="status" className="px-4 py-6 text-sm text-muted-foreground">{report.overview.agencyCount === 0 ? "ไม่มียอดขายติดจองในช่วงที่เลือก" : "ไม่พบเอเจนซี่ที่ตรงกับตัวกรอง"}</p></div> : <>
      <div className="hidden overflow-hidden rounded-xl border border-border/70 bg-card md:block"><Table className="table-fixed bg-card [&_tr]:border-border/70"><TableHeader className="bg-secondary"><TableRow><TableHead className="w-[55%]">ชื่อเอเจนซี่</TableHead><TableHead className="w-[20%] text-right">จำนวนการจองติดจอง</TableHead><TableHead className="w-[25%] text-right">ยอดขาย</TableHead></TableRow></TableHeader><TableBody>{page.rows.map(row => <DashboardAgencyTableRow key={row.id ?? "unassigned"} agency={row} href={dashboardAgencyDetailHref(query, row.id ?? "unassigned")} />)}</TableBody></Table></div>
      <div className="space-y-3 md:hidden">{page.rows.map(row => <DashboardAgencyRow key={row.id ?? "unassigned"} presentation={mobileRedesign ? "summary" : "default"} agency={row} href={dashboardAgencyDetailHref(query, row.id ?? "unassigned")} />)}</div>
    </>}
    <div className={mobileRedesign ? "mt-4 hidden md:block" : "mt-4"}><DashboardPager {...page} href={pageNumber => dashboardAgenciesHref(query, { page: pageNumber })} /></div>
    {mobileRedesign && <div className="mt-4 md:hidden"><DashboardMobilePager {...page} label="แบ่งหน้ารายการเอเจนซี่" href={pageNumber => dashboardAgenciesHref(query, { page: pageNumber })} /><p className="mt-3 text-center text-[11px] text-muted-foreground">แตะที่รายการเพื่อดูรายละเอียดและรายการจอง</p></div>}
  </section>;
}
