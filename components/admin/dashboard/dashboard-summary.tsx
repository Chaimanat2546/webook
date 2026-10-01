import Link from "next/link";
import { DASHBOARD_STATUSES, type DashboardQuery, type DashboardReport } from "../../../lib/dashboard";
import { dashboardMoney } from "../../../lib/dashboard";
import { Card, CardContent } from "../../ui/card";

export function DashboardSummary({ report, query }: { report: DashboardReport; query: DashboardQuery }) {
  const statuses = DASHBOARD_STATUSES.filter(item => item.value !== "unknown" || report.statusCounts.unknown > 0);
  return <Card><CardContent className="grid gap-5 py-0 md:grid-cols-[minmax(13rem,0.8fr)_minmax(0,1.2fr)]"><section className="py-1 md:border-r md:pr-5"><p className="text-sm text-muted-foreground">ยอดขายจากการจอง</p><p className="mt-1 break-words text-3xl font-semibold tabular-nums">{dashboardMoney(report.sales.amountCents)}</p></section><section><p className="text-sm text-muted-foreground">สถานะการจอง <span className="font-medium text-foreground">{report.bookingCount.toLocaleString("th-TH")}</span> รายการ</p><div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">{statuses.map(item => <Link key={item.value} href={`/admin/dashboard/bookings?month=${encodeURIComponent(query.month)}&status=${item.value}`} className="min-h-11 rounded-md text-sm hover:bg-muted focus-visible:outline-2"><span className="block text-xl font-semibold tabular-nums">{report.statusCounts[item.value].toLocaleString("th-TH")}</span><span className="text-xs text-muted-foreground">{item.value === "repair" ? "ปิดซ่อม" : item.label}</span></Link>)}</div></section></CardContent></Card>;
}
