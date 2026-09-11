"use client";

import { Download, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { InstallAppInstructions } from "./install-app-menu-item";
import { usePwa } from "./pwa-provider";

const subscribeReady = () => () => {};

export function LoginInstallPrompt() {
  const { installed, canPrompt, install } = usePwa();
  const ready = useSyncExternalStore(subscribeReady, () => true, () => false);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [error, setError] = useState("");

  async function handleInstall() {
    if (!canPrompt) { setHelpOpen(true); return; }
    setBusy(true);
    setError("");
    try {
      const result = await install();
      if (result === "accepted" || result === "dismissed") setDismissed(true);
      else setHelpOpen(true);
    } catch {
      setError("ยังติดตั้งไม่ได้ กรุณาลองอีกครั้งหรือดูวิธีติดตั้ง");
      setHelpOpen(true);
    } finally {
      setBusy(false);
    }
  }

  if (!ready || installed || dismissed) return null;
  return <>
    <section aria-label="แนะนำติดตั้งแอป" className="relative w-full max-w-sm rounded-xl bg-black p-4 text-white shadow-lg">
      <div role="status" className="pr-10">
        <p className="flex items-center gap-2 font-semibold"><Download aria-hidden className="size-5" />ติดตั้ง WeBooks เป็นแอป</p>
        <p className="mt-1 text-sm text-zinc-300">เปิดใช้งานจากหน้าจอหลักได้สะดวกขึ้น</p>
      </div>
      <Button aria-label="ไว้ทีหลัง" className="absolute right-1 top-1 min-h-12 min-w-12 text-white hover:bg-zinc-800 hover:text-white" disabled={busy} onClick={() => setDismissed(true)} size="icon" type="button" variant="ghost"><X aria-hidden /></Button>
      <Button className="mt-3 min-h-12 w-full bg-white text-black hover:bg-zinc-200" disabled={busy} onClick={handleInstall} type="button"><Download aria-hidden />{busy ? "กำลังเปิดหน้าติดตั้ง…" : canPrompt ? "ติดตั้งแอป" : "ดูวิธีติดตั้งแอป"}</Button>
      {error && <p role="alert" className="mt-2 text-sm text-zinc-200">{error}</p>}
    </section>
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader><DialogTitle>ติดตั้ง WeBooks</DialogTitle><DialogDescription>เลือกวิธีติดตั้งตามเบราว์เซอร์ที่ใช้งาน การดูข้อมูลและบันทึกงานต้องใช้อินเทอร์เน็ต</DialogDescription></DialogHeader>
        {canPrompt && <Button className="min-h-12" disabled={busy} onClick={handleInstall} type="button"><Download aria-hidden />ติดตั้งแอป</Button>}
        <InstallAppInstructions />
      </DialogContent>
    </Dialog>
  </>;
}
