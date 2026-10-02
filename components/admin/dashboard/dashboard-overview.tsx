import Link from "next/link";
import {
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  House,
  type LucideIcon,
} from "lucide-react";
import { type DashboardQuery, type DashboardReport } from "../../../lib/dashboard";
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
      <DashboardSummary report={report} query={query} />

      <Card className="min-h-[21rem] gap-2">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <h2>จำนวนการจอง</h2>
            <Link
              href={`/admin/dashboard/bookings?month=${encodeURIComponent(query.month)}&status=confirmed`}
              className="inline-flex min-h-11 shrink-0 items-center text-sm font-normal text-primary hover:underline focus-visible:outline-2"
            >
              ดูทั้งหมด
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1">
          {report.sales.count > 0 ? (
            <ConfirmedBookingsChart points={report.overview.confirmedBookingsByDay} />
          ) : (
            <DashboardOverviewEmptyState
              icon={CalendarDays}
              title="ยังไม่มีรายการติดจอง"
              description="รายการติดจองรายวันจะแสดงที่นี่"
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
                <h2>ยอดขายเอเจนซี่</h2>
                <Link
                  href={`/admin/dashboard/agencies?month=${encodeURIComponent(query.month)}`}
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
                <h2>บ้านใหม่</h2>
                <Link
                  href={`/admin/dashboard/houses?month=${encodeURIComponent(query.month)}`}
                  className="inline-flex min-h-11 shrink-0 items-center text-sm font-normal text-primary hover:underline focus-visible:outline-2"
                >
                  ดูทั้งหมด
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1">
              {report.overview.recentHouses.length ? (
                <div className="flex w-full flex-1 flex-col divide-y [&>a]:flex-1">
                  {report.overview.recentHouses.map((house) => (
                    <DashboardHouseRow
                      key={house.id}
                      house={house}
                      href={`/admin/dashboard/houses/${encodeURIComponent(house.id)}?month=${encodeURIComponent(query.month)}`}
                    />
                  ))}
                </div>
              ) : (
                <DashboardOverviewEmptyState
                  icon={House}
                  title="ยังไม่มีบ้านเพิ่มใหม่"
                  description="บ้านที่เพิ่มในเดือนนี้จะแสดงที่นี่"
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
