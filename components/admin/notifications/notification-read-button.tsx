"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../../ui/button";
import { readNotifications } from "../../../app/admin/notifications/actions";

export function NotificationReadButton({ id, read }: { id: string; read: boolean }) {
  const [done, setDone] = useState(read);
  const [pending, setPending] = useState(false);
  async function mark() {
    setPending(true);
    try {
      const result = await readNotifications({ id });
      if (result.ok) { setDone(true); window.dispatchEvent(new Event("webook-notifications-refresh")); }
      else toast.error(result.message);
    } catch { toast.error("ไม่สามารถบันทึกสถานะอ่านได้ กรุณาลองใหม่"); }
    finally { setPending(false); }
  }
  return <Button variant="outline" disabled={done || pending} onClick={() => void mark()}>{done ? "อ่านแล้ว" : pending ? "กำลังบันทึก…" : "ทำเครื่องหมายว่าอ่านแล้ว"}</Button>;
}
