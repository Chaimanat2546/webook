"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";

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
    <Alert role="status" aria-live="polite" className="mb-4">
      <WifiOff aria-hidden />
      <AlertTitle>ขณะนี้คุณออฟไลน์</AlertTitle>
      <AlertDescription>การดูข้อมูลใหม่และบันทึกงานต้องใช้อินเทอร์เน็ต กรุณาเชื่อมต่อก่อนดำเนินการต่อ และอย่าปิดหน้าที่ยังมีงานไม่ได้บันทึก</AlertDescription>
    </Alert>
  );
}

export function ConnectionStatus() {
  const offline = useSyncExternalStore(subscribe, getOfflineSnapshot, () => false);
  return <ConnectionNotice offline={offline} />;
}
