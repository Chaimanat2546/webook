import { DashboardDetailLayout } from "../dashboard-detail-layout";
import { WebsiteAnalyticsHouseList } from "./house-list";
import { Eye, Images, MousePointerClick, Phone, MessageCircle } from "lucide-react";
import { Card, CardContent } from "../../../ui/card";
import { DashboardTaskHeader } from "../dashboard-task-header";
import { websiteAnalyticsHref, type WebsiteAnalyticsQuery, type WebsiteAnalyticsReport } from "../../../../lib/website-analytics";
import { WebsiteAnalyticsFilters, type WebsiteOption } from "./filters";
import { WebsiteDailyChart } from "./daily-chart";
import { WebsiteAnalyticsTables } from "./tables";

const headlines = [
  { key: "page_views", label: "ยอดเข้าชม", note: "รวมการเปิดหน้าเว็บไซต์ทุกครั้ง", icon: Eye },
  { key: "contact_clicks", label: "กดติดต่อรวม", note: "รวมการกดโทร LINE และ Messenger", icon: MousePointerClick },
  { key: "gallery_opens", label: "ยอดเปิดรูป", note: "จำนวนครั้งที่เปิดดูรูปบ้าน", icon: Images },
] as const;
const channels = [{ key: "phone_clicks", label: "กดโทร", icon: Phone }, { key: "line_clicks", label: "LINE", icon: MessageCircle }, { key: "chat_clicks", label: "Messenger", icon: MessageCircle }] as const;
export function WebsiteAnalyticsView({ report, query, sites }: { report: WebsiteAnalyticsReport; query: WebsiteAnalyticsQuery; sites: WebsiteOption[] }) {
  const full = query.view === "houses";
  if (full) return <div className="website-analytics-theme"><DashboardDetailLayout>
    <DashboardTaskHeader title="สถิติบ้านทั้งหมด" description={`${report.websites[0]?.displayName ?? "เว็บไซต์"} · จำนวนครั้งที่เข้าชมและกดติดต่อ`} backHref={websiteAnalyticsHref(query, { view: undefined, sort: undefined, search: undefined, page: 1, pages: {} })} backLabel="กลับไปภาพรวม" />
    <section>
      <WebsiteAnalyticsFilters key={`${query.site}:${query.month}:${query.search ?? ""}:${query.sort ?? ""}`} query={query} sites={sites} maxMonth={new Date(Date.parse(report.period.as_of) + 7 * 3600000).toISOString().slice(0, 7)} />
      <WebsiteAnalyticsHouseList report={report} query={query} />
    </section>
  </DashboardDetailLayout></div>;
  const count = (key: typeof headlines[number]["key"] | typeof channels[number]["key"]) => report.totals ? report.totals[key].toLocaleString("th-TH") : "—";
  return <div className="website-analytics-theme mx-auto min-w-0 max-w-7xl space-y-3 md:space-y-6">
    <DashboardTaskHeader title="ภาพรวมผลเว็บไซต์และบ้าน" description="จำนวนครั้งที่เข้าชมและกดติดต่อ ไม่ใช่จำนวนคนไม่ซ้ำ" backHref={`/admin/dashboard?month=${query.month}`} backLabel="กลับ Dashboard" />
    <WebsiteAnalyticsFilters key={`${query.site}:${query.month}:${query.search ?? ""}:${query.sort ?? ""}`} query={query} sites={sites} maxMonth={new Date(Date.parse(report.period.as_of) + 7 * 3600000).toISOString().slice(0, 7)} />
    <div className="hidden flex-wrap justify-between gap-2 text-xs text-muted-foreground md:flex"><span>{report.period.from_date} ถึง {report.period.to_date} · เวลาไทย</span><span>ข้อมูลถึง {new Date(report.period.as_of).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</span></div>
    {report.availableSites < report.selectedSites && <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      {report.status === "unavailable" ? "ยังโหลดสถิติไม่ได้ กรุณาตรวจสอบสถานะแต่ละเว็บไซต์แล้วลองใหม่" : `บางเว็บไซต์โหลดไม่ได้: โหลดได้ ${report.availableSites} จาก ${report.selectedSites} เว็บไซต์ กรุณาลองใหม่`}
    </div>}
    <Card><CardContent className="space-y-3 md:space-y-6">
      <div className="grid grid-cols-3 divide-x gap-2 md:gap-5">{headlines.map(({ key, label, note, icon: Icon }) => <div key={key} className="min-w-0 space-y-1 pr-1 md:space-y-2 md:pr-5">
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground md:gap-2 md:text-sm"><Icon className="hidden size-4 md:block" aria-hidden />{label}</p>
        <p className={`break-words text-xl font-semibold tabular-nums sm:text-3xl ${key === "contact_clicks" ? "text-primary" : ""}`}>{count(key)} <span className="block text-[10px] font-normal text-muted-foreground md:inline md:text-xs">ครั้ง</span></p>
        <p className="hidden text-xs text-muted-foreground md:block">{note}</p>
      </div>)}</div>
      <div className="grid grid-cols-3 items-center gap-1 border-t pt-3 md:flex md:flex-wrap md:gap-3 md:pt-4"><p className="mr-auto hidden text-sm text-muted-foreground md:block">ช่องทางติดต่อ</p>{channels.map(({key, label, icon: Icon}) => <div key={key} className="flex min-w-0 flex-wrap items-center justify-center gap-1 text-[11px] md:gap-2 md:rounded-lg md:border md:bg-muted/30 md:px-3 md:py-2 md:text-sm"><Icon aria-hidden className="size-4 text-primary" /><span>{key === "chat_clicks" ? "แชท" : label}</span><strong className="tabular-nums">{count(key)}</strong><span className="hidden text-xs text-muted-foreground md:inline">ครั้ง</span></div>)}</div>
    </CardContent></Card>
    <WebsiteDailyChart points={report.daily} monthly={report.monthly} query={query} available={report.totals !== null} />
    {report.totals && report.totals.page_views === 0 && report.totals.contact_clicks === 0 && report.totals.gallery_opens === 0 && <p className="text-sm text-muted-foreground">{report.status === "complete" ? "ยังไม่มีเหตุการณ์ในช่วงนี้" : "ยังไม่พบเหตุการณ์ในข้อมูลที่โหลดได้"}</p>}
    <WebsiteAnalyticsTables report={report} query={query} />
  </div>;
}
