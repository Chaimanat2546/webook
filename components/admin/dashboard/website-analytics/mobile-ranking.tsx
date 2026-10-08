import { ChevronRight } from "lucide-react";
import type { AnalyticsMetrics, WebsiteSummary } from "../../../../lib/website-analytics";

const grid = "grid grid-cols-[minmax(0,1fr)_3.25rem_3.25rem_2.5rem_1rem] items-center gap-1";
function Breakdown({ metrics }: { metrics: AnalyticsMetrics | null | undefined }) {
  return <dl className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3 text-xs">{([['โทร', metrics?.phone_clicks], ['LINE', metrics?.line_clicks], ['แชท', metrics?.chat_clicks]] as const).map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold tabular-nums">{value?.toLocaleString('th-TH') ?? '—'}</dd></div>)}</dl>;
}
export function MobileRanking({ site }: { site: WebsiteSummary }) {
  const count = (value: number | undefined) => value?.toLocaleString('th-TH') ?? '—';
  return <div className="md:hidden" aria-label={`อันดับบ้าน ${site.displayName}`}>
    <div className={`${grid} border-y bg-muted/40 px-1 py-2 text-[11px] text-muted-foreground`}><span>บ้าน</span><span className="text-right">ติดต่อ</span><span className="text-right">เข้าชม</span><span className="text-right">รูป</span><span /></div>
    {site.villas?.rows.slice(0, 5).map((villa, index) => <details key={villa.villa_id} className="group border-b">
      <summary className={`${grid} min-h-14 cursor-pointer list-none rounded-sm px-1 py-2 text-xs focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden`}>
        <span className="flex min-w-0 items-center gap-2"><span className="text-muted-foreground">{index + 1}</span><span className="min-w-0"><span className="block truncate font-medium">{villa.title ?? 'ไม่พบชื่อบ้านในทะเบียน'}</span><span className="mt-0.5 block text-[11px] text-muted-foreground">DV-{villa.villa_id}</span></span></span>
        <strong className="min-w-0 break-all text-right tabular-nums text-primary">{count(villa.contact_clicks)}</strong><span className="min-w-0 break-all text-right tabular-nums">{count(villa.page_views)}</span><span className="min-w-0 break-all text-right tabular-nums">{count(villa.gallery_opens)}</span><ChevronRight aria-hidden className="size-3 transition-transform group-open:rotate-90" />
      </summary>
      <div className="space-y-2 px-1 pb-3"><p className="break-words text-xs">{villa.title ?? `บ้าน DV-${villa.villa_id}`}</p><Breakdown metrics={villa} /></div>
    </details>)}
    {!site.villas?.total && <p className="py-4 text-center text-xs text-muted-foreground">ยังไม่มีข้อมูลแยกบ้านจากเว็บไซต์ที่โหลดได้</p>}
    <p className="pt-2 text-[11px] text-muted-foreground">กดบ้านเพื่อดูช่องทางติดต่อ</p>
    <details className="mt-2 border-t pt-2"><summary className="cursor-pointer text-xs text-muted-foreground">ยอดรวมทั้งเว็บไซต์และกิจกรรมที่ไม่ระบุบ้าน</summary><div className="space-y-3 py-2">{([['รวมทั้งเว็บไซต์', site.totals], ['กิจกรรมที่ไม่ระบุบ้าน', site.unattributed]] as const).map(([label, metrics]) => <div key={label}><p className="mb-2 text-xs font-medium">{label} · เข้าชม {count(metrics?.page_views)} · ติดต่อ {count(metrics?.contact_clicks)} · รูป {count(metrics?.gallery_opens)}</p><Breakdown metrics={metrics} /></div>)}</div></details>
  </div>;
}
