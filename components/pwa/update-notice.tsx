"use client";

import { useEffect, useState } from "react";
import { activateUpdate, observeUpdates, type UpdateWorker } from "../../lib/pwa/updates";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";

export function UpdateNotice({ registration }: { registration: ServiceWorkerRegistration | null }) {
  const [waiting, setWaiting] = useState<UpdateWorker | null>(null);
  const [changed, setChanged] = useState(false);
  const [deferred, setDeferred] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!registration) return;
    return observeUpdates(registration, navigator.serviceWorker, (worker) => {
      setWaiting(worker);
    }, () => {
      setChanged(true);
      setWaiting(null);
      setDeferred(false);
    });
  }, [registration]);

  if (!waiting && !changed) return null;

  async function update() {
    if (busy) return;
    if (!navigator.onLine) {
      setError("กรุณาเชื่อมต่ออินเทอร์เน็ตก่อนโหลดเวอร์ชันใหม่");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const target = registration?.waiting;
      if (target) {
        await activateUpdate(navigator.serviceWorker, target);
      } else if (!changed) {
        throw new Error("No waiting worker");
      }
      // Only this explicitly confirmed window reloads. Existing beforeunload
      // protections remain active and can still cancel the navigation.
      window.location.reload();
    } catch {
      setError("ยังอัปเดตไม่สำเร็จ ลองอีกครั้ง หรือบันทึกงานแล้วปิดหน้าต่าง WeBooks ทุกหน้าต่างและเปิดใหม่");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg pb-[env(safe-area-inset-bottom)]">
      {deferred ? (
        <Button variant="outline" onClick={() => setDeferred(false)}>มีเวอร์ชันใหม่</Button>
      ) : (
        <Alert role="status" className="bg-background shadow-lg">
          <AlertTitle>{changed ? "เวอร์ชันใหม่พร้อมใช้งาน" : "มีเวอร์ชันใหม่"}</AlertTitle>
          <AlertDescription>
            <p>บันทึกงานก่อนโหลดใหม่ หน้าต่างอื่นจะไม่ถูกรีโหลดอัตโนมัติ</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setOpen(true)}>{changed ? "โหลดเวอร์ชันใหม่" : "อัปเดตตอนนี้"}</Button>
              <Button size="sm" variant="outline" onClick={() => setDeferred(true)}>ภายหลัง</Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>บันทึกงานก่อนอัปเดต</DialogTitle>
            <DialogDescription>หน้านี้จะโหลดใหม่ ข้อมูลที่ยังไม่ได้บันทึกอาจสูญหาย หากยังมีงานค้างให้กลับไปบันทึกก่อน หน้าต่างอื่นจะยังเปิดอยู่</DialogDescription>
          </DialogHeader>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button disabled={busy} onClick={() => void update()}>{busy ? "กำลังอัปเดต…" : "บันทึกงานแล้ว โหลดใหม่"}</Button>
          <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>กลับไปทำงานต่อ</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
