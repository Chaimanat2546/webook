"use client";

import { Settings, X } from "lucide-react";
import { Button } from "../../ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../../ui/sheet";
import { PushSettings } from "./push-settings";

export function NotificationsSettings() {
  return <Sheet>
    <SheetTrigger asChild>
      <Button type="button" variant="ghost" size="icon" className="size-11" aria-label="ตั้งค่าการแจ้งเตือน"><Settings aria-hidden className="size-5" /></Button>
    </SheetTrigger>
    <SheetContent side="bottom" showCloseButton={false} className="mx-auto max-h-[85dvh] w-full max-w-lg gap-0 overflow-y-auto rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
      <SheetHeader className="border-b px-5 py-4 pr-16">
        <SheetTitle>ตั้งค่าการแจ้งเตือน</SheetTitle>
        <SheetDescription>จัดการการรับแจ้งเตือนบนอุปกรณ์นี้</SheetDescription>
      </SheetHeader>
      <SheetClose asChild><Button type="button" variant="ghost" size="icon" className="absolute top-3 right-3 size-11" aria-label="ปิดการตั้งค่าการแจ้งเตือน"><X aria-hidden className="size-5" /></Button></SheetClose>
      <div className="px-5 py-5"><PushSettings /></div>
    </SheetContent>
  </Sheet>;
}
