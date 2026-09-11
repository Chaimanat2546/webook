import { AdminFallbackBack } from "../../components/layout/admin-fallback-back";

export default function AdminNotFound() {
  return <div className="mx-auto max-w-xl space-y-4 p-4"><h1 className="text-lg font-semibold">ไม่พบหน้าที่ต้องการ</h1><p className="text-muted-foreground">รายการนี้อาจถูกลบ หรือคุณไม่มีสิทธิ์เข้าถึง</p><AdminFallbackBack /></div>;
}
