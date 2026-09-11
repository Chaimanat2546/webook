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
    <div className="fixed inset-x-4 top-[calc(env(safe-area-inset-top)+1rem)] z-50 mx-auto max-w-lg">
      {deferred ? (
        <Button variant="outline" onClick={() => setDeferred(false)}>มีเวอร์ชันใหม่</Button>
      ) : (
        <Alert role="status" className="bg-background shadow-lg">
          <AlertTitle>มีเวอร์ชันใหม่พร้อมใช้งาน</AlertTitle>
          <AlertDescription>
            <p>กรุณาบันทึกงานที่กำลังทำก่อนอัปเดต</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button className="min-h-11" onClick={() => setOpen(true)}>อัปเดตตอนนี้</Button>
              <Button className="min-h-11" variant="outline" onClick={() => setDeferred(true)}>ไว้ทีหลัง</Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>บันทึกงานก่อนอัปเดต</DialogTitle>
            <DialogDescription>แอปจะเปิดหน้านี้ใหม่หลังอัปเดต ข้อมูลที่ยังไม่ได้บันทึกอาจหาย กรุณาบันทึกงานให้เรียบร้อยก่อนดำเนินการต่อ</DialogDescription>
          </DialogHeader>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button disabled={busy} onClick={() => void update()}>{busy ? "กำลังอัปเดต…" : "บันทึกงานแล้ว อัปเดตเลย"}</Button>
          <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>กลับไปทำงานต่อ</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
