"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import { usePwa } from "./pwa-provider";

export function InstallAppMenuItem() {
  const { installed, canPrompt, install } = usePwa();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (installed) return null;

  async function handleInstall() {
    setBusy(true);
    setError("");
    try {
      const result = await install();
      setOpen(result === "unavailable");
    } catch {
      setError("ยังติดตั้งไม่ได้ กรุณาลองใช้เมนูติดตั้งของเบราว์เซอร์");
      setOpen(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SidebarMenuItem>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <SidebarMenuButton disabled={busy} tooltip="ติดตั้งแอป" onClick={event => {
            if (canPrompt) {
              event.preventDefault();
              void handleInstall();
            }
          }}>
            <Download aria-hidden />
            <span>ติดตั้งแอป</span>
          </SidebarMenuButton>
        </DialogTrigger>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ติดตั้ง WeBooks</DialogTitle>
            <DialogDescription>เปิดระบบจากหน้าจอหลักได้สะดวกขึ้น การดูข้อมูลและบันทึกงานต้องใช้อินเทอร์เน็ต</DialogDescription>
          </DialogHeader>
          {canPrompt || busy ? (
            <Button type="button" disabled={busy} onClick={handleInstall}>
              <Download aria-hidden />
              {busy ? "กำลังเปิดหน้าติดตั้ง..." : "ติดตั้งแอป WeBooks"}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">หากเบราว์เซอร์รองรับ ให้เปิดเมนูของเบราว์เซอร์ แล้วเลือก “ติดตั้งแอป” หรือ “เพิ่มลงในหน้าจอหลัก”</p>
          )}
          <InstallAppInstructions />
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        </DialogContent>
      </Dialog>
    </SidebarMenuItem>
  );
}

export function InstallAppInstructions() {
  return <><p className="text-sm text-muted-foreground">เปิดเมนูเบราว์เซอร์ แล้วเลือก “ติดตั้งแอป” หรือ “เพิ่มลงในหน้าจอหลัก” หากมีตัวเลือก</p>
          <div className="space-y-2 text-sm">
            <p className="font-medium">สำหรับ iPhone / iPad</p>
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>แนะนำให้เปิดเว็บไซต์นี้ใน Safari</li>
              <li>แตะเมนูแชร์ แล้วเลือก “เพิ่มไปยังหน้าจอโฮม”</li>
              <li>เปิด “เปิดเป็นเว็บแอป” หากมีตัวเลือก แล้วแตะ “เพิ่ม”</li>
            </ol>
            <p className="text-muted-foreground">iOS/iPadOS 16.4 ขึ้นไปอาจเพิ่มผ่านเมนูแชร์ของเบราว์เซอร์อื่นที่รองรับได้เช่นกัน</p>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-medium">สำหรับ Safari บน Mac</p>
            <p className="text-muted-foreground">บน macOS Sonoma 14 ขึ้นไป เลือกเมนูไฟล์หรือแชร์ แล้วเลือก “เพิ่มไปยัง Dock”</p>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-medium">สำหรับ Firefox บน Windows</p>
            <p className="text-muted-foreground">ใช้ปุ่มเว็บแอปในแถบที่อยู่ของ Firefox รุ่น 143 ขึ้นไป หรือรุ่น 150 ขึ้นไปหากติดตั้งจาก Microsoft Store</p>
          </div>
  </>;
}
