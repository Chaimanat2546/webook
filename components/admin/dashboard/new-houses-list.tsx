import { dashboardHouseDetailHref, dashboardHousesHref } from "../../../lib/dashboard-routes";
import type { DashboardHousesQuery, DashboardReport } from "../../../lib/dashboard";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "../../ui/table";
import { DashboardHouseCard, DashboardHouseTableRow } from "./dashboard-rows";
import { DashboardPager } from "./dashboard-list-primitives";
import { DashboardHouseFilters } from "./dashboard-house-filters";

export function NewHousesList({ report, query }: { report: DashboardReport; query: DashboardHousesQuery }) {
  if (!report.admin) return null;
  const page = report.admin.houses;
  return <section>
    <DashboardHouseFilters key={`${query.month}:${query.search}`} query={query} />
    {page.total === 0 ? <div className="overflow-hidden rounded-xl border"><p role="status" className="px-4 py-6 text-sm text-muted-foreground">{report.overview.newHouseCount === 0 ? "ไม่มีบ้านเพิ่มใหม่ในเดือนนี้" : "ไม่พบบ้านที่ตรงกับตัวกรอง"}</p></div> : <>
      <div className="hidden overflow-hidden rounded-xl border md:block"><Table className="table-fixed"><TableHeader><TableRow><TableHead>บ้าน / DV</TableHead><TableHead className="w-[12rem] text-right">วันที่เพิ่ม</TableHead></TableRow></TableHeader><TableBody>{page.rows.map(row => <DashboardHouseTableRow key={row.id} house={row} href={dashboardHouseDetailHref(query, row.id)} />)}</TableBody></Table></div>
      <div className="space-y-3 md:hidden">{page.rows.map(row => <DashboardHouseCard key={row.id} house={row} href={dashboardHouseDetailHref(query, row.id)} />)}</div>
    </>}
    <div className="mt-4"><DashboardPager {...page} href={pageNumber => dashboardHousesHref(query, { page: pageNumber })} /></div>
  </section>;
}
