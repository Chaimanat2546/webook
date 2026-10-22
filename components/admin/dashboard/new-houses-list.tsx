import { dashboardHouseDetailHref, dashboardHousesHref } from "../../../lib/dashboard-routes";
import { DASHBOARD_HOUSES_PAGE_SIZE, type DashboardHousesQuery, type DashboardReport } from "../../../lib/dashboard";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "../../ui/table";
import { DashboardHouseCard, DashboardHouseTableRow } from "./dashboard-rows";
import { DashboardMobilePager, DashboardPager } from "./dashboard-list-primitives";
import { DashboardMobileListControls, DashboardMobileListResults } from "./dashboard-mobile-list-controls";
import { DashboardHouseFilters } from "./dashboard-house-filters";

export function NewHousesList({ report, query, mobileRedesign = false }: { report: DashboardReport; query: DashboardHousesQuery; mobileRedesign?: boolean }) {
  if (!report.admin) return null;
  const page = report.admin.houses;
  return <section>
    <div className={mobileRedesign ? "hidden md:block" : undefined}><DashboardHouseFilters key={`${query.month}:${query.search}`} query={query} /></div>
    {mobileRedesign && <><DashboardMobileListControls key={JSON.stringify(query)} kind="houses" query={query} /><DashboardMobileListResults kind="houses" query={query} total={page.total} page={page.page} pageSize={DASHBOARD_HOUSES_PAGE_SIZE} /></>}
    {page.total === 0 ? <div className="overflow-hidden rounded-xl border border-border/70 bg-card"><p role="status" className="px-4 py-6 text-sm text-muted-foreground">{report.overview.newHouseCount === 0 ? "ไม่มีบ้านเพิ่มใหม่ในเดือนนี้" : "ไม่พบบ้านที่ตรงกับตัวกรอง"}</p></div> : <>
      <div className="hidden overflow-hidden rounded-xl border border-border/70 bg-card md:block"><Table className="table-fixed bg-card [&_tr]:border-border/70"><TableHeader className="bg-secondary"><TableRow><TableHead>บ้าน / DV</TableHead><TableHead className="w-[12rem] text-right">วันที่เพิ่ม</TableHead></TableRow></TableHeader><TableBody>{page.rows.map(row => <DashboardHouseTableRow key={row.id} house={row} href={dashboardHouseDetailHref(query, row.id)} />)}</TableBody></Table></div>
      <div className="space-y-3 md:hidden">{page.rows.map(row => <DashboardHouseCard key={row.id} presentation={mobileRedesign ? "cover" : "default"} house={row} href={dashboardHouseDetailHref(query, row.id)} />)}</div>
    </>}
    <div className={mobileRedesign ? "mt-4 hidden md:block" : "mt-4"}><DashboardPager {...page} pageSize={mobileRedesign ? DASHBOARD_HOUSES_PAGE_SIZE : 10} href={pageNumber => dashboardHousesHref(query, { page: pageNumber })} /></div>
    {mobileRedesign && <div className="mt-4 md:hidden"><DashboardMobilePager {...page} label="แบ่งหน้ารายการบ้าน" href={pageNumber => dashboardHousesHref(query, { page: pageNumber })} /><p className="mt-3 text-center text-[11px] text-muted-foreground">แตะที่รายการเพื่อดูรายละเอียดบ้าน</p></div>}
  </section>;
}
