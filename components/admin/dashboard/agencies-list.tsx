import { Button } from "../../ui/button";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "../../ui/table";
import { SearchIcon } from "lucide-react";
import { dashboardAgencyDetailHref, dashboardAgenciesHref } from "../../../lib/dashboard-routes";
import type { DashboardListQuery, DashboardReport } from "../../../lib/dashboard";
import { DashboardAgencyTableRow } from "./dashboard-rows";
import { DashboardMonthFilter, DashboardPager, DashboardSearchFilter } from "./dashboard-list-primitives";

export function AgenciesList({ report, query }: { report: DashboardReport; query: DashboardListQuery }) {
  if (!report.admin) return null;
  const page = report.admin.agencies;
  return <section>
    <form action="/admin/dashboard/agencies" method="get" className="mb-3 grid min-w-0 grid-cols-2 gap-2 sm:mb-4 sm:flex sm:flex-wrap sm:max-w-2xl"><DashboardSearchFilter ariaLabel="ค้นหาเอเจนซี่" name="search" value={query.search} placeholder="ค้นหาเอเจนซี่..." /><DashboardMonthFilter id="agency-month" month={query.month} /><Button className="col-span-2 h-11 w-full px-3 sm:col-span-1 sm:w-auto" type="submit"><SearchIcon aria-hidden className="size-4" /><span>ค้นหา</span></Button></form>
    <div className="overflow-hidden rounded-xl border">
      {page.total === 0 ? <p role="status" className="px-4 py-6 text-sm text-muted-foreground">{report.overview.agencyCount === 0 ? "ไม่มียอดขายติดจองในเดือนนี้" : "ไม่พบเอเจนซี่ที่ตรงกับตัวกรอง"}</p> : <Table className="table-fixed min-w-[32rem]"><TableHeader><TableRow><TableHead className="w-[55%]">ชื่อเอเจนซี่</TableHead><TableHead className="w-[20%] text-right">จำนวนการจอง</TableHead><TableHead className="w-[25%] text-right">ยอดขาย</TableHead></TableRow></TableHeader><TableBody>{page.rows.map(row => <DashboardAgencyTableRow key={row.id ?? "unassigned"} agency={row} href={dashboardAgencyDetailHref(query, row.id ?? "unassigned")} />)}</TableBody></Table>}
    </div>
    <div className="mt-4"><DashboardPager {...page} href={pageNumber => dashboardAgenciesHref(query, { page: pageNumber })} /></div>
  </section>;
}
