"use client";

import { CalendarPlus, Check, ChevronRight, CircleX, Hourglass } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { type BookingNotification, notificationEventLabel } from "../../../lib/booking-notifications";
import { Badge } from "../../ui/badge";
import { Card } from "../../ui/card";
import { useNotifications } from "./notifications-context";

const eventStyles = {
  booking_created: { Icon: CalendarPlus, label: "การจองใหม่", color: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  payment_succeeded: { Icon: Check, label: "ชำระสำเร็จ", color: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  payment_expired: { Icon: Hourglass, label: "หมดเวลาชำระ", color: "bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  booking_cancelled: { Icon: CircleX, label: "ยกเลิกการจอง", color: "bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300" },
};
const dates = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Bangkok" });
const times = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
function date(value: string) {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? dates.format(parsed) : "–";
}
function relativeTime(value: string, asOf: string) {
  const minutes = Math.floor((new Date(asOf).getTime() - new Date(value).getTime()) / 60_000);
  if (!Number.isFinite(minutes)) return "–";
  if (minutes < 1) return "เมื่อสักครู่";
  if (minutes < 60) return minutes + " นาทีที่แล้ว";
  if (minutes < 1440) return Math.floor(minutes / 60) + " ชั่วโมงที่แล้ว";
  return date(value) + " " + times.format(new Date(value)) + " น.";
}
export function NotificationItem({ item, asOf }: { item: BookingNotification; asOf: string }) {
  const notifications = useNotifications();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const { Icon, label, color } = eventStyles[item.eventType];
  const href = "/admin/notifications/" + item.id;
  const status = item.status === "waiting" ? "รอโอน" : item.status === "confirmed" ? "ติดจอง" : item.status === "cancelled" ? "ยกเลิก" : item.status;
  return <li><Card className="gap-0 overflow-hidden rounded-2xl py-0 shadow-xs">
    <Link href={href} prefetch={false} aria-busy={pending} className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset hover:bg-muted/30" onClick={async (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        if (!item.readAt) void notifications?.markRead({ id: item.id });
        return;
      }
      if (pending) { event.preventDefault(); return; }
      if (!item.readAt) {
        event.preventDefault(); setPending(true);
        try { await notifications?.markRead({ id: item.id }); notifications?.setOpen(false); router.push(href); }
        finally { setPending(false); }
      } else notifications?.setOpen(false);
    }}>
      <div className="flex items-start gap-3 p-4 pb-3">
        <span className={"flex size-11 shrink-0 items-center justify-center rounded-full " + color}><Icon aria-hidden className="size-5" /></span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2"><Badge className={"rounded px-2 py-0.5 text-xs " + color}>{label}</Badge><time dateTime={item.createdAt} className="text-xs text-muted-foreground">{relativeTime(item.createdAt, asOf)}</time></div>
          <p className="font-semibold break-words leading-snug">{item.title || "บ้านพัก"}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">รหัส <span className="font-semibold text-foreground">DV-{item.propertyId}</span> · เข้าพัก {date(item.checkIn)} – {date(item.checkOut)}</p>
          <p className="text-xs text-muted-foreground">{notificationEventLabel(item.eventType, item.source)} · สถานะปัจจุบัน: {status}</p>
        </div>
        {!item.readAt && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-primary" role="img" aria-label="ยังไม่อ่าน" />}
      </div>
      <div className="ml-[4.5rem] flex min-h-11 items-center justify-between gap-2 bg-muted/40 px-4 py-2 text-sm font-medium text-primary"><span>ดูรายละเอียด</span><ChevronRight aria-hidden className="size-4" /></div>
    </Link>
  </Card></li>;
}
