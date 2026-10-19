import { dashboardDateFilter } from "../../../lib/dashboard";
import { dashboardPeriodParams } from "../../../lib/dashboard-routes";
import { analyticsTimeRangeLabel } from "../../../lib/website-analytics-time";
import Link from "next/link";
import {
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  House,
  type LucideIcon,
} from "lucide-react";
import { type DashboardQuery, type DashboardReport } from "../../../lib/dashboard";
import { dashboardHouseDetailHref } from "../../../lib/dashboard-routes";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../../ui/empty";
import { DashboardHouseRow } from "./dashboard-rows";
import { AgencyChart } from "./agency-chart";
import { ConfirmedBookingsChart } from "./confirmed-bookings-chart";
import { DashboardSummary } from "./dashboard-summary";

interface DashboardOverviewEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

function DashboardOverviewEmptyState({
  icon: Icon,
  title,
  description,
}: DashboardOverviewEmptyStateProps) {
  return (
    <Empty className="border-0 p-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function DashboardOverviewView({ report, query }: { report: DashboardReport; query: DashboardQuery }) {
  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">เวลาไทย · {analyticsTimeRangeLabel(query.dateFrom && query.dateTo ? { from: query.dateFrom, to: query.dateTo, timeFrom: query.timeFrom, timeTo: query.timeTo } : undefined)} · การจองตามเวลาอัปเดตล่าสุด · บ้านใหม่ตามเวลาสร้าง</p>
      <DashboardSummary report={report} query={query} />

      <Card className="min-h-[21rem] gap-2">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <h2>จำนวนการจองในช่วงที่เลือก</h2>
            <Link
              href={`/admin/dashboard/bookings?${dashboardPeriodParams(query)}&status=confirmed`}
              className="inline-flex min-h-11 shrink-0 items-center text-sm font-normal text-primary hover:underline focus-visible:outline-2"
            >
              ดูทั้งหมด
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1">
          {report.sales.count > 0 ? (
            <ConfirmedBookingsChart points={report.overview.confirmedBookingsByHour ?? report.overview.confirmedBookingsByDay} granularity={report.overview.confirmedBookingsByHour ? "hour" : "day"} />
          ) : (
            <DashboardOverviewEmptyState
              icon={CalendarDays}
              title="ยังไม่มีรายการติดจอง"
              description={`รายการติดจอง${report.overview.confirmedBookingsByHour ? "รายชั่วโมง" : "รายวัน"}จะแสดงที่นี่`}
            />
          )}
        </CardContent>
      </Card>

      {report.sales.missingPrices > 0 && (
        <p role="status" className="rounded-lg border p-3 text-sm">
          มีรายการติดจอง {report.sales.missingPrices} รายการที่ยังไม่ระบุยอด จึงนับจำนวนแต่ไม่นำยอดเงินมารวม
        </p>
      )}

      {report.admin && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="min-h-[20rem] h-full gap-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <h2>ยอดขายเอเจนซี่สูงสุด 5 อันดับ</h2>
                <Link
                  href={`/admin/dashboard/agencies?${dashboardPeriodParams(query)}`}
                  className="inline-flex min-h-11 shrink-0 items-center text-sm font-normal text-primary hover:underline focus-visible:outline-2"
                >
                  ดูทั้งหมด
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1">
              {report.overview.topAgencies.length ? (
                <AgencyChart agencies={report.overview.topAgencies} />
              ) : (
                <DashboardOverviewEmptyState
                  icon={ChartNoAxesColumnIncreasing}
                  title="ยังไม่มียอดขายเอเจนซี่"
                  description="เมื่อมีรายการติดจอง ข้อมูลจะแสดงที่นี่"
                />
              )}
            </CardContent>
          </Card>

          <Card className="min-h-[20rem] h-full gap-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <h2>บ้านใหม่ในช่วงที่เลือก</h2>
                <Link
                  href={`/admin/dashboard/houses?${dashboardPeriodParams(query)}`}
                  className="inline-flex min-h-11 shrink-0 items-center text-sm font-normal text-primary hover:underline focus-visible:outline-2"
                >
                  ดูทั้งหมด
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1">
              {report.overview.recentHouses.length ? (
                <div className="flex w-full flex-1 flex-col divide-y">
                  {report.overview.recentHouses.map((house) => (
                    <DashboardHouseRow
                      key={house.id}
                      house={house}
                      href={dashboardHouseDetailHref({ month: query.month, ...dashboardDateFilter(query), search: "", page: 1 }, house.id, "overview")}
                    />
                  ))}
                </div>
              ) : (
                <DashboardOverviewEmptyState
                  icon={House}
                  title="ยังไม่มีบ้านเพิ่มใหม่"
                  description="บ้านที่เพิ่มในช่วงที่เลือกจะแสดงที่นี่"
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
