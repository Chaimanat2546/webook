"use client";

import { useEffect, useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";

const OFFLINE_TOAST_ID = "webooks-offline";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function getOfflineSnapshot() {
  return navigator.onLine === false;
}

export function ConnectionNotice({ offline }: { offline: boolean }) {
  if (!offline) return null;
  return (
    <div role="status" aria-live="polite" className="flex items-start gap-3">
      <WifiOff aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="space-y-1">
        <p className="font-semibold">ขณะนี้คุณออฟไลน์</p>
        <p className="text-xs font-normal text-zinc-300">กรุณาเชื่อมต่ออินเทอร์เน็ตก่อนดูข้อมูลใหม่หรือบันทึกงาน และอย่าปิดหน้าที่ยังไม่ได้บันทึก</p>
      </div>
    </div>
  );
}

export function ConnectionStatus() {
  const offline = useSyncExternalStore(subscribe, getOfflineSnapshot, () => false);
  useEffect(() => {
    if (!offline) {
      toast.dismiss(OFFLINE_TOAST_ID);
      return;
    }
    toast(<ConnectionNotice offline />, {
      id: OFFLINE_TOAST_ID,
      duration: Infinity,
      dismissible: false,
      closeButton: false,
    });
    return () => { toast.dismiss(OFFLINE_TOAST_ID); };
  }, [offline]);
  return null;
}
