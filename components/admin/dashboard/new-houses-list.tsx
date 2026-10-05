import { Button } from "../../ui/button";
import { SearchIcon } from "lucide-react";
import { dashboardHouseDetailHref, dashboardHousesHref } from "../../../lib/dashboard-routes";
import type { DashboardListQuery, DashboardReport } from "../../../lib/dashboard";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "../../ui/table";
import { DashboardHouseCard, DashboardHouseTableRow } from "./dashboard-rows";
import { DashboardMonthFilter, DashboardPager, DashboardSearchFilter } from "./dashboard-list-primitives";

export function NewHousesList({ report, query }: { report: DashboardReport; query: DashboardListQuery }) {
  if (!report.admin) return null;
  const page = report.admin.houses;
  return <section>
    <form action="/admin/dashboard/houses" method="get" className="mb-3 grid min-w-0 grid-cols-2 gap-2 sm:mb-4 sm:flex sm:flex-wrap sm:max-w-2xl"><DashboardSearchFilter ariaLabel="ค้นหาบ้าน" name="search" value={query.search} placeholder="ค้นหาบ้าน..." /><DashboardMonthFilter id="houses-month" month={query.month} /><Button className="col-span-2 h-11 w-full px-3 sm:col-span-1 sm:w-auto" type="submit"><SearchIcon aria-hidden className="size-4" /><span>ค้นหา</span></Button></form>
    {page.total === 0 ? <div className="overflow-hidden rounded-xl border"><p role="status" className="px-4 py-6 text-sm text-muted-foreground">{report.overview.newHouseCount === 0 ? "ไม่มีบ้านเพิ่มใหม่ในเดือนนี้" : "ไม่พบบ้านที่ตรงกับตัวกรอง"}</p></div> : <>
      <div className="hidden overflow-hidden rounded-xl border md:block"><Table className="table-fixed"><TableHeader><TableRow><TableHead>บ้าน / DV</TableHead><TableHead className="w-[12rem] text-right">วันที่เพิ่ม</TableHead></TableRow></TableHeader><TableBody>{page.rows.map(row => <DashboardHouseTableRow key={row.id} house={row} href={dashboardHouseDetailHref(query, row.id)} />)}</TableBody></Table></div>
      <div className="space-y-3 md:hidden">{page.rows.map(row => <DashboardHouseCard key={row.id} house={row} href={dashboardHouseDetailHref(query, row.id)} />)}</div>
    </>}
    <div className="mt-4"><DashboardPager {...page} href={pageNumber => dashboardHousesHref(query, { page: pageNumber })} /></div>
  </section>;
}
