"use client";
import { Button } from "../../../../components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div role="alert" className="space-y-3 rounded-lg border p-6"><h1 className="text-xl font-semibold">โหลดสถิติไม่สำเร็จ</h1><p>กรุณาลองอีกครั้ง</p><Button onClick={reset}>ลองใหม่</Button></div>;
}
