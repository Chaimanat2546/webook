"use client";

import { Menu } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { useSidebar } from "../ui/sidebar";
import { cn } from "../../lib/utils";
import { NotificationBell } from "../admin/notifications/notification-bell";

export function AdminMobileBrandHeader({ subtitle, asOf, className, audit = false }: { subtitle: ReactNode; asOf?: string; className?: string; audit?: boolean }) {
  const { setOpenMobile } = useSidebar();
  const now = asOf ? new Date(asOf) : new Date();
  return <header className={cn("flex min-h-16 items-center gap-3 border-b bg-background px-4 pt-[env(safe-area-inset-top)] md:hidden print:hidden", audit && "min-h-[62px] gap-2 bg-card", className)}>
    <button type="button" aria-label="เปิดเมนูหลัก" onClick={() => setOpenMobile(true)} className="flex size-9 shrink-0 items-center justify-center rounded-full focus-visible:outline-2"><Menu aria-hidden className="size-5" /></button>
    <Image src="/brand/webooks-logo-transparent.png" alt="โลโก้ WeBooks" width={500} height={500} className={audit ? "size-8 shrink-0 object-contain" : "size-12 shrink-0 object-contain"} />
    <div className="min-w-0 flex-1"><p className={cn("text-lg font-semibold leading-tight text-primary-text", audit && "text-base text-foreground")}>WeBooks</p><div className="min-w-0 text-[11px] text-muted-foreground">{subtitle}</div></div>
    <time className="shrink-0 rounded-full border bg-background px-3 py-1 text-[11px] font-medium text-primary-text" dateTime={now.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" })}>{new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" }).format(now)}</time>
    <NotificationBell />
  </header>;
}
