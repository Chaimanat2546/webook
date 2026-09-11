"use client";

import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";

export function PageError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-xl space-y-4 p-4">
      <Alert>
        <AlertCircle aria-hidden />
        <AlertTitle>ยังโหลดหน้านี้ไม่ได้</AlertTitle>
        <AlertDescription>กรุณาตรวจการเชื่อมต่อแล้วลองโหลดอีกครั้ง หากเกิดปัญหาระหว่างบันทึก ให้ตรวจผลในรายการก่อนส่งคำสั่งซ้ำ</AlertDescription>
      </Alert>
      <Button type="button" onClick={reset}>ลองโหลดอีกครั้ง</Button>
    </div>
  );
}
