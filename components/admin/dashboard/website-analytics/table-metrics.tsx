import { TableCell } from "../../../ui/table";
import type { AnalyticsMetrics, WebsiteSummary } from "../../../../lib/website-analytics";

export const labels: Record<WebsiteSummary["status"], string> = {
  complete: "ข้อมูลครบ", partial: "ข้อมูลไม่ครบช่วง", not_configured: "ยังไม่ได้ตั้งค่า", unauthorized: "ตรวจสอบสิทธิ์ต้นทางไม่ผ่าน",
  rate_limited: "เรียกข้อมูลเกินกำหนด", timeout: "หมดเวลารอข้อมูล", unavailable: "โหลดไม่สำเร็จ", invalid_report: "ข้อมูลต้นทางไม่ถูกต้อง",
};
export const columns = [{ key: "page_views", label: "เข้าชม" }, { key: "contact_clicks", label: "ติดต่อรวม" }, { key: "phone_clicks", label: "โทร" }, { key: "line_clicks", label: "LINE" }, { key: "chat_clicks", label: "Messenger" }, { key: "gallery_opens", label: "เปิดรูป" }] as const;
export function MetricCells({ metrics }: { metrics: AnalyticsMetrics | null | undefined }) {
  return columns.map(column => <TableCell key={column.key} className={`text-right tabular-nums ${column.key === "contact_clicks" ? "font-semibold text-primary" : ""}`}>{metrics ? metrics[column.key].toLocaleString("th-TH") : "—"}</TableCell>);
}
