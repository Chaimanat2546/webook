import Link from "next/link";
import { Banknote, ChevronRight, Handshake, House } from "lucide-react";
import { DASHBOARD_STATUSES, dashboardMoney, type DashboardQuery, type DashboardReport } from "../../../lib/dashboard";
import { dashboardPeriodParams } from "../../../lib/dashboard-routes";
import { Card, CardContent } from "../../ui/card";
import { ConfirmedBookingsChart } from "./confirmed-bookings-chart";

export function DashboardMobileSectionTitle({ title, step }: { title: string; step: string }) {
  return <div className="mb-4 flex items-center gap-2"><span aria-hidden className="h-4 w-1.5 shrink-0 rounded-full bg-teal-600" /><h2 className="min-w-0 flex-1 text-sm font-semibold">{title}</h2><span className="text-xs text-muted-foreground">{step}</span></div>;
}

export function DashboardMobileOverview({ report, query, websites }: { report: DashboardReport; query: DashboardQuery; websites: boolean }) {
  const params = dashboardPeriodParams(query);
  const totalSections = report.admin ? websites ? 4 : 3 : 2;
  const statuses = DASHBOARD_STATUSES.filter(item => item.value !== "unknown" || report.statusCounts.unknown > 0);
  return <div className="space-y-7 md:hidden">
    <section id="dashboard-business" data-dashboard-section className="scroll-mt-4">
      <DashboardMobileSectionTitle title="ภาพรวมความสมบูรณ์และผลการดำเนินงานธุรกิจ" step={`1/${totalSections}`} />
      <Card className="gap-0 rounded-3xl border-slate-200/70 py-4 shadow-none dark:border-border"><CardContent className="px-4">
        <div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="text-xs text-muted-foreground">ยอดขายจากการจองติดจอง</p><p className="mt-1 break-all text-[1.75rem] font-bold leading-tight tabular-nums">{dashboardMoney(report.sales.amountCents)} <span className="text-xs font-medium text-muted-foreground">THB</span></p></div><span className="rounded-full bg-teal-600/10 p-2.5 text-teal-600"><Banknote aria-hidden className="size-5" /></span></div>
        <div className="mt-3 flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border-t border-slate-100 pt-2 text-[11px] dark:border-border"><Link className="rounded-full bg-muted px-2 py-1 font-semibold" href={`/admin/dashboard/bookings?${params}&status=all`}>รวม {report.bookingCount.toLocaleString("th-TH")}</Link>{statuses.map(item => <Link key={item.value} href={`/admin/dashboard/bookings?${params}&status=${item.value}`} className={`inline-flex min-h-8 items-center hover:underline ${item.value === "confirmed" ? "text-teal-600" : item.value === "cancelled" ? "text-rose-600" : "text-muted-foreground"}`}>{item.value === "repair" ? "ปิดซ่อม" : item.label} {report.statusCounts[item.value].toLocaleString("th-TH")}</Link>)}<Link href={`/admin/dashboard/bookings?${params}&status=all`} aria-label="ดูการจองทั้งหมด" className="ml-auto inline-flex min-h-9 min-w-7 items-center justify-center text-muted-foreground"><ChevronRight aria-hidden className="size-4" /></Link></div>
      </CardContent></Card>
      {report.sales.missingPrices > 0 && <p role="status" className="mt-2 text-xs text-amber-700">ติดจอง {report.sales.missingPrices} รายการยังไม่ระบุยอด จึงไม่นำยอดเงินมารวม</p>}
    </section>
    <section id="dashboard-trend" data-dashboard-section className="scroll-mt-4">
      <DashboardMobileSectionTitle title="แนวโน้มการจอง" step={`2/${totalSections}`} />
      <h3 className="mb-4 text-sm font-semibold">จำนวนการจองในช่วงที่เลือก</h3>
      <ConfirmedBookingsChart points={report.overview.confirmedBookingsByHour ?? report.overview.confirmedBookingsByDay} granularity={report.overview.confirmedBookingsByHour ? "hour" : "day"} presentation="area" />
      <Link href={`/admin/dashboard/bookings?${params}&status=confirmed`} className="mt-2 flex min-h-11 items-center justify-between gap-2 border-t text-xs"><span className="flex items-center gap-2 text-muted-foreground"><span aria-hidden className="size-2.5 rounded-full bg-teal-600" />ติดจองในช่วงที่เลือก</span><span className="font-semibold">รวม {report.sales.count.toLocaleString("th-TH")} ครั้ง</span></Link>
    </section>
    {report.admin && <section id="dashboard-operations" data-dashboard-section className="scroll-mt-4">
      <DashboardMobileSectionTitle title="การติดตามงานปฏิบัติการ" step={`3/${totalSections}`} />
      <div className="divide-y border-y">
        <Link href={`/admin/dashboard/agencies?${params}`} className="flex min-h-18 items-center gap-3 py-3"><span className="rounded-full bg-muted p-2 text-muted-foreground"><Handshake aria-hidden className="size-5" /></span><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">ยอดขายเอเจนซี่</h3><p className="text-xs text-muted-foreground">{report.overview.topAgencies.length ? `${report.overview.topAgencies[0].name} · ${dashboardMoney(report.overview.topAgencies[0].amountCents)}` : "ยังไม่มีข้อมูลเอเจนซี่ที่ระบุชื่อในช่วงที่เลือก"}</p></div><span className="flex shrink-0 items-center gap-1 text-xs text-teal-600">ดูทั้งหมด<ChevronRight aria-hidden className="size-4" /></span></Link>
        <Link href={`/admin/dashboard/houses?${params}`} className="flex min-h-18 items-center gap-3 py-3"><span className="rounded-full bg-teal-600/10 p-2 text-teal-600"><House aria-hidden className="size-5" /></span><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">บ้านใหม่ในช่วงที่เลือก <span className="inline-block rounded-full bg-teal-600/10 px-2 py-1 text-[11px] text-teal-600">{report.overview.newHouseCount.toLocaleString("th-TH")} หลัง</span></h3><p className="text-xs text-muted-foreground">ดูรายละเอียดบ้านที่เพิ่มในช่วงที่เลือก</p></div><span className="flex shrink-0 items-center gap-1 text-xs text-teal-600">ดูทั้งหมด<ChevronRight aria-hidden className="size-4" /></span></Link>
      </div>
    </section>}
  </div>;
}
