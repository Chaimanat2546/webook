import Link from "next/link";
import { dashboardHref } from "../../../lib/dashboard-navigation";
import { dashboardShare } from "../../../lib/dashboard-calculations";
import { type DashboardQuery, type DashboardReport } from "../../../lib/dashboard";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Input } from "../../ui/input";
import { DashboardAgencyRow, DashboardBookingRow, DashboardHouseRow } from "./dashboard-rows";

function Pager({ page, pages, total, href }: { page: number; pages: number; total: number; href: (next: number) => string }) { return <div className="flex items-center justify-between gap-3 pt-4 text-sm text-muted-foreground"><span>{total ? `${(page - 1) * 10 + 1}–${Math.min(page * 10, total)} จาก ${total}` : "0 รายการ"}</span><span className="flex gap-2">{page > 1 && <Button asChild size="sm" variant="outline"><Link href={href(page - 1)}>ก่อนหน้า</Link></Button>}{page < pages && <Button asChild size="sm" variant="outline"><Link href={href(page + 1)}>ถัดไป</Link></Button>}</span></div>; }
export function DashboardLists({ report, query }: { report: DashboardReport; query: DashboardQuery }) {
  const filter=(name:string,value:string,placeholder:string)=><form method="get" className="mb-4 flex gap-2"><input type="hidden" name="month" value={query.month}/><input type="hidden" name="view" value={query.view}/><Input name={name} defaultValue={value} placeholder={placeholder}/><Button type="submit" variant="outline">ค้นหา</Button></form>;
  if(query.view==="bookings"){const page=report.bookings;return <Card><CardHeader><CardTitle>ข้อมูลการจอง</CardTitle></CardHeader><CardContent>{filter("search",query.search,"บ้าน เลข DV หรือรหัสจอง")}<div className="divide-y">{page.rows.map(row=><DashboardBookingRow key={row.id} booking={row} href={dashboardHref(query,{view:"booking",from:"bookings",bookingId:row.id})}/>)}</div><Pager {...page} href={next=>dashboardHref(query,{page:next})}/></CardContent></Card>;}
  if(query.view==="agencies"&&report.admin){const page=report.admin.agencies;return <Card><CardHeader><CardTitle>ยอดขายเอเจนซี่</CardTitle></CardHeader><CardContent>{filter("agencySearch",query.agencySearch,"ค้นหาเอเจนซี่")}<div className="divide-y">{page.rows.map(row=><DashboardAgencyRow key={row.id??"unassigned"} agency={row} sharePercent={dashboardShare(row.amountCents,report.sales.amountCents)} href={dashboardHref(query,{view:"agency",from:"agencies",agency:row.id??"unassigned"})}/>)}</div><Pager {...page} href={next=>dashboardHref(query,{agenciesPage:next})}/></CardContent></Card>;}
  const page=report.admin!.houses;return <Card><CardHeader><CardTitle>ประวัติบ้านเพิ่มใหม่</CardTitle></CardHeader><CardContent>{filter("houseSearch",query.houseSearch,"ชื่อบ้าน หรือเลข DV")}<div className="divide-y">{page.rows.map(row=><DashboardHouseRow key={row.id} house={row} href={dashboardHref(query,{view:"house",from:"houses",houseId:row.id})}/>)}</div><Pager {...page} href={next=>dashboardHref(query,{housesPage:next})}/></CardContent></Card>;
}
