"use client";

import { Settings, X } from "lucide-react";
import { Button } from "../../ui/button";
import { useIsMobile } from "../../../hooks/use-mobile";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../../ui/dialog";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../../ui/sheet";
import { PushSettings } from "./push-settings";

export function NotificationsSettings() {
  const mobile = useIsMobile();
  const Root = mobile ? Sheet : Dialog;
  const Trigger = mobile ? SheetTrigger : DialogTrigger;
  const Content = mobile ? SheetContent : DialogContent;
  const Header = mobile ? SheetHeader : DialogHeader;
  const Title = mobile ? SheetTitle : DialogTitle;
  const Description = mobile ? SheetDescription : DialogDescription;
  const Close = mobile ? SheetClose : DialogClose;

  return <Root>
    <Trigger asChild>
      <Button type="button" variant="ghost" size="icon" className="size-11" aria-label="ตั้งค่าการแจ้งเตือน"><Settings aria-hidden className="size-5" /></Button>
    </Trigger>
    <Content {...(mobile ? { side: "bottom" as const } : {})} showCloseButton={false} className={mobile
      ? "max-h-[85dvh] w-full gap-0 overflow-y-auto rounded-t-3xl p-0"
      : "max-h-[85dvh] gap-0 overflow-y-auto p-0 sm:max-w-md"}>
      <Header className="gap-1 px-5 pt-5 pb-4 pr-16 text-left md:px-6 md:pt-6 md:pr-16">
        <Title>ตั้งค่าการแจ้งเตือน</Title>
        <Description>จัดการการแจ้งเตือนสำหรับอุปกรณ์นี้</Description>
      </Header>
      <Close asChild><Button type="button" variant="ghost" size="icon" className="absolute top-3 right-3 size-11" aria-label="ปิดการตั้งค่าการแจ้งเตือน"><X aria-hidden className="size-5" /></Button></Close>
      <div className="px-5 md:px-6 md:pb-6"><PushSettings /></div>
    </Content>
  </Root>;
}
