"use client";

import { Bell, CheckCheck, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BookingNotification } from "../../../lib/booking-notifications";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../../ui/sheet";
import { Skeleton } from "../../ui/skeleton";
import { useNotifications } from "./notifications-context";
import { PushSettings } from "./push-settings";

const dateFormat = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Bangkok" });
const timeFormat = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
function date(value: string, withTime = false) { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? "–" : (withTime ? timeFormat : dateFormat).format(parsed); }

function NotificationItem({ item }: { item: BookingNotification }) {
  const notifications = useNotifications();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return <li className="border-b last:border-b-0">
    <Link href={`/admin/notifications/${item.id}`} prefetch={false} className={`block rounded-lg p-4 focus-visible:outline-2 ${item.readAt ? "hover:bg-muted/50" : "bg-primary/5 hover:bg-primary/10"}`} onClick={async (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        if (!item.readAt) void notifications?.markRead({ id: item.id });
        return;
      }
      if (pending) { event.preventDefault(); return; }
      // Let the explicit action start before navigation; GET and prefetch never mutate.
      if (!item.readAt) {
        event.preventDefault();
        setPending(true);
        await notifications?.markRead({ id: item.id });
        notifications?.setOpen(false);
        router.push(`/admin/notifications/${item.id}`);
      } else notifications?.setOpen(false);
    }} aria-busy={pending}>
      <div className="flex items-start gap-2"><p className="min-w-0 flex-1 font-medium break-words">{item.title} <span className="whitespace-nowrap text-xs text-muted-foreground">DV {item.propertyId}</span></p>{!item.readAt && <Badge variant="secondary" className="shrink-0">ยังไม่อ่าน</Badge>}</div>
      <p className="mt-1 text-sm">{item.source === "ical" ? "นำเข้า booking จาก iCal" : "มี booking ใหม่"}</p>
      <p className="mt-1 text-xs text-muted-foreground">{date(item.checkIn)} – {date(item.checkOut)}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Badge variant="outline">{item.status === "waiting" ? "รอโอน" : item.status === "confirmed" ? "ติดจอง" : item.status}</Badge><span>{item.source === "ical" ? "iCal" : "ในระบบ"}</span><time dateTime={item.createdAt}>{date(item.createdAt, true)}</time></div>
    </Link>
  </li>;
}

export function NotificationsSheet() {
  const notifications = useNotifications();
  const [reading, setReading] = useState(false);
  if (!notifications) return null;
  const { data, error, loading, page } = notifications;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return <Sheet open={notifications.open} onOpenChange={notifications.setOpen}>
    <SheetContent className="w-full! max-w-md! gap-0 pb-[env(safe-area-inset-bottom)] print:hidden">
      <SheetHeader className="border-b pr-14"><SheetTitle className="flex items-center gap-2"><Bell aria-hidden className="size-5" />การแจ้งเตือน</SheetTitle><SheetDescription>รายการ booking ใหม่ที่คุณมีสิทธิ์ดู</SheetDescription></SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b p-4"><PushSettings /></div>
        <div className="flex items-center justify-between gap-2 px-4 py-3"><p className="text-sm text-muted-foreground" aria-live="polite">{data ? `ยังไม่อ่าน ${data.unreadCount} รายการ` : "ยังไม่ทราบจำนวนที่ยังไม่อ่าน"}</p><Button type="button" variant="ghost" size="sm" disabled={!data || data.unreadCount === 0 || reading || !!error} onClick={async () => {
          if (!data) return;
          setReading(true);
          try { await notifications.markRead({ before: data.asOf }); } finally { setReading(false); }
        }}><CheckCheck aria-hidden />อ่านทั้งหมด</Button></div>
        {error && <div role="alert" className="mx-4 mb-3 rounded-lg border p-3"><p className="text-sm">{error}</p><Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => { void notifications.refresh(); }}>ลองอีกครั้ง</Button></div>}
        {loading && !data && <div className="space-y-3 p-4" role="status" aria-label="กำลังโหลดการแจ้งเตือน">{[1, 2, 3].map((key) => <Skeleton key={key} className="h-24 w-full" />)}</div>}
        {!loading && !error && data?.items.length === 0 && <p className="px-4 py-12 text-center text-sm text-muted-foreground">ยังไม่มีการแจ้งเตือน</p>}
        {data && <ul aria-label="รายการแจ้งเตือน" aria-busy={loading} className="px-2">{data.items.map((item) => <NotificationItem key={item.id} item={item} />)}</ul>}
      </div>
      {data && <div className="flex items-center justify-between gap-3 border-t p-4"><Button type="button" size="sm" variant="outline" aria-label="หน้าก่อนหน้า" disabled={loading || page <= 1} onClick={() => notifications.setPage(page - 1)}><ChevronLeft aria-hidden />ก่อนหน้า</Button><span className="text-xs text-muted-foreground">หน้า {page} / {pages}</span><Button type="button" size="sm" variant="outline" aria-label="หน้าถัดไป" disabled={loading || page >= pages} onClick={() => notifications.setPage(page + 1)}>ถัดไป<ChevronRight aria-hidden /></Button></div>}
    </SheetContent>
  </Sheet>;
}
