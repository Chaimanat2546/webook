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
      if (await install() === "accepted") setOpen(false);
    } catch {
      setError("ยังติดตั้งไม่ได้ กรุณาลองใช้เมนูติดตั้งของเบราว์เซอร์");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SidebarMenuItem>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <SidebarMenuButton tooltip="ติดตั้งแอป">
            <Download aria-hidden />
            <span>ติดตั้งแอป</span>
          </SidebarMenuButton>
        </DialogTrigger>
        <DialogContent>
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
          <div className="space-y-2 text-sm">
            <p className="font-medium">สำหรับ iPhone / iPad</p>
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>เปิดเว็บไซต์นี้ใน Safari</li>
              <li>แตะเมนูแชร์ แล้วเลือก “เพิ่มไปยังหน้าจอโฮม”</li>
              <li>เปิด “เปิดเป็นเว็บแอป” หากมีตัวเลือก แล้วแตะ “เพิ่ม”</li>
            </ol>
          </div>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        </DialogContent>
      </Dialog>
    </SidebarMenuItem>
  );
}
