"use client";

import { Button } from "../../../components/ui/button";

export default function DashboardError({ reset }: { reset: () => void }) {
  return <div role="alert" className="space-y-3 rounded-lg border p-6"><h1 className="text-xl font-semibold">โหลด Dashboard ไม่สำเร็จ</h1><p className="text-sm text-muted-foreground">กรุณาลองใหม่อีกครั้ง</p><Button onClick={reset}>ลองอีกครั้ง</Button></div>;
}
