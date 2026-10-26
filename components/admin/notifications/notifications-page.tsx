"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "../../ui/button";
import { NotificationsInbox } from "./notifications-inbox";
import { NotificationsSettings } from "./notifications-settings";

export function NotificationsPage() {
  const router = useRouter();
  return <section className="-mx-4 -my-5 flex min-h-[calc(100dvh-6rem)] flex-col md:mx-auto md:my-0 md:min-h-[70dvh] md:max-w-2xl md:overflow-hidden md:rounded-2xl md:border">
    <header className="flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center gap-2 border-b bg-background px-3 pt-[env(safe-area-inset-top)]">
      <Button type="button" variant="ghost" size="icon" className="size-11" aria-label="ย้อนกลับ" onClick={() => {
        if (window.history.length > 1) router.back(); else router.replace("/admin/dashboard");
      }}><ArrowLeft aria-hidden /></Button><h1 className="min-w-0 flex-1 text-lg font-semibold">การแจ้งเตือน</h1>
      <NotificationsSettings />
    </header>
    <NotificationsInbox />
  </section>;
}
