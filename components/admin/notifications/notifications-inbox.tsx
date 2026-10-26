"use client";

import { Bell, CalendarPlus, Check, CircleX, LoaderCircle, RefreshCw, Wallet } from "lucide-react";
import { useEffect, useRef } from "react";
import { notificationDay, type BookingNotification, type NotificationFilter } from "../../../lib/booking-notifications";
import { Button } from "../../ui/button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "../../ui/empty";
import { Skeleton } from "../../ui/skeleton";
import { NotificationItem } from "./notification-item";
import { useNotifications } from "./notifications-context";

const filters = [
  { value: "all", label: "ทั้งหมด", Icon: Bell },
  { value: "booking", label: "จองใหม่", Icon: CalendarPlus },
  { value: "payment", label: "ชำระเงิน", Icon: Wallet },
  { value: "cancelled", label: "ยกเลิก", Icon: CircleX },
] satisfies { value: NotificationFilter; label: string; Icon: typeof Bell }[];
const dates = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });
function groups(items: BookingNotification[], asOf: string) {
  const today = notificationDay(asOf);
  const yesterday = notificationDay(new Date(new Date(asOf).getTime() - 86_400_000).toISOString());
  const result = new Map<string, { title: string; date: string; items: BookingNotification[] }>();
  for (const item of items) {
    const key = notificationDay(item.createdAt);
    if (!result.has(key)) result.set(key, { title: key === today ? "วันนี้" : key === yesterday ? "เมื่อวาน" : "ก่อนหน้านี้", date: key === "unknown" ? "ไม่ทราบวันที่" : dates.format(new Date(item.createdAt)), items: [] });
    result.get(key)!.items.push(item);
  }
  return [...result.entries()];
}
export function NotificationsInbox({ active = true, surface = "page" }: { active?: boolean; surface?: "sheet" | "page" }) {
  const notifications = useNotifications();
  const beginInboxSession = notifications?.beginInboxSession;
  useEffect(() => {
    if (!active) return;
    return beginInboxSession?.(surface);
  }, [active, beginInboxSession, surface]);
  const scrollArea = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const hasMore = Boolean(notifications?.data?.nextCursor);
  const loadMore = notifications?.loadMore;
  const loadingMore = notifications?.loadingMore ?? false;
  const loadMoreError = notifications?.loadMoreError;
  const itemCount = notifications?.data?.items.length ?? 0;
  useEffect(() => {
    if (!active || !hasMore || loadingMore || loadMoreError || !loadMore || !sentinel.current || typeof IntersectionObserver === "undefined") return;
    const area = scrollArea.current;
    // Mobile scrolls the document; the desktop Sheet owns an inner scroll area.
    const root = area && area.scrollHeight > area.clientHeight ? area : null;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void loadMore();
    }, { root, rootMargin: "200px 0px" });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [active, hasMore, loadingMore, loadMoreError, loadMore, itemCount]);
  if (!notifications) return null;
  const { data, error, loading, filter } = notifications;
  const displayTime = notifications.observedAt ?? data?.asOf;
  return <div className="relative flex min-h-0 flex-1 flex-col bg-[#f7f9fb] [--primary:#087F80] [--primary-foreground:#fff] dark:bg-background dark:[--primary:#2BAFC0] dark:[--primary-foreground:#043D5C]">
    <div className="shrink-0 py-2">
      <div role="group" aria-label="หมวดการแจ้งเตือน" className="flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filters.map(({ value, label, Icon }) => <Button key={value} type="button" variant={filter === value ? "default" : "secondary"} className="min-h-11 shrink-0 rounded-full px-3" aria-pressed={filter === value} onClick={() => {
          if (filter === value) return;
          scrollArea.current?.scrollTo({ top: 0, behavior: "instant" });
          notifications.setFilter(value);
        }}>
          <Icon aria-hidden className="size-4" />{label}
        </Button>)}
      </div>
      <p className="sr-only" aria-live="polite">{data ? "ยังไม่อ่าน " + data.unreadCount + " รายการ" : "ยังไม่ทราบจำนวนที่ยังไม่อ่าน"}</p>
    </div>
    {data?.hasNew && <div className="pointer-events-none fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 md:absolute md:top-16 md:bottom-auto" role="status">
      <Button type="button" disabled={loading} className="pointer-events-auto min-h-11 rounded-full px-5 shadow-lg" onClick={async () => {
        if (!await notifications.acceptNew()) return;
        const area = scrollArea.current;
        if (area && area.scrollHeight > area.clientHeight) area.scrollTo({ top: 0 });
        else window.scrollTo({ top: 0 });
      }}><RefreshCw aria-hidden />มีแจ้งเตือนใหม่</Button>
    </div>}
    <div ref={scrollArea} className="min-h-0 flex-1 overflow-y-auto px-4 pb-5" aria-busy={loading}>
      {error && <div role="alert" className="my-3 rounded-xl border bg-card p-4"><p className="text-sm">{error}</p><Button type="button" variant="outline" className="mt-3 min-h-11" onClick={() => { void notifications.acceptNew(); }}>ลองอีกครั้ง</Button></div>}
      {loading && !data && <div className="space-y-3 pt-3" role="status" aria-label="กำลังโหลดการแจ้งเตือน">{[1, 2, 3].map(key => <Skeleton key={key} className="h-40 w-full rounded-2xl" />)}</div>}
      {!loading && !error && data && !data.hasNew && data.items.length === 0 && <Empty className="min-h-[55dvh] border-0 px-2">
        <EmptyHeader>
          <EmptyMedia className="relative mb-5 flex size-28 items-center justify-center rounded-full bg-primary/10 text-primary"><Bell aria-hidden className="size-12" /><span className="absolute -right-1 bottom-0 flex size-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check aria-hidden className="size-5" /></span></EmptyMedia>
          <EmptyTitle className="text-xl font-bold">{filter === "all" ? "ยังไม่มีการแจ้งเตือน" : "ไม่พบรายการในหมวดนี้"}</EmptyTitle>
          <EmptyDescription className="leading-relaxed">{filter === "all" ? "เมื่อมีความเคลื่อนไหวการจองหรือสถานะการชำระเงิน ระบบจะแจ้งให้คุณทราบที่นี่" : "ลองเลือกหมวดอื่น หรือรีเฟรชเพื่อตรวจสอบข้อมูลล่าสุด"}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent><Button type="button" className="mt-4 min-h-11 rounded-full px-6" onClick={() => { void notifications.acceptNew(); }}><RefreshCw aria-hidden />รีเฟรชข้อมูล</Button></EmptyContent>
      </Empty>}
      {data && displayTime && groups(data.items, displayTime).map(([key, group]) => <section key={key} className="mt-3 mb-6" aria-label={group.title + " " + group.date}>
        <h2 className="mb-2 px-1 text-xs font-semibold text-muted-foreground">{group.title === "ก่อนหน้านี้" ? group.date : group.title}</h2>
        <ul aria-label="รายการแจ้งเตือน" className="space-y-2">{group.items.map(item => <NotificationItem key={item.id} item={item} asOf={displayTime} />)}</ul>
      </section>)}
      {hasMore && <div className="py-3 text-center">
        <div ref={sentinel} className="h-px" aria-hidden />
        {loadMoreError && <p role="alert" className="mb-2 text-sm text-destructive">{loadMoreError}</p>}
        <Button type="button" variant="outline" className="min-h-11" disabled={loadingMore || loading} onClick={() => { void notifications.loadMore(); }}>
          {loadingMore ? <><LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" /><span role="status">กำลังโหลดเพิ่มเติม…</span></> : loadMoreError ? "ลองโหลดเพิ่มเติมอีกครั้ง" : "โหลดเพิ่มเติม"}
        </Button>
      </div>}
      {data && data.items.length > 0 && !hasMore && <p className="py-3 text-center text-xs text-muted-foreground">โหลดรายการเก่าครบแล้ว</p>}
    </div>
  </div>;
}
