import { CUSTOMER_FIELDS, type BookingCustomerInput } from "@/lib/booking-customers";
import { Building2, ClipboardCheck, Contact, MapPin, NotebookPen, UserRound } from "lucide-react";

const sections = [
  { key: "general", label: "ข้อมูลทั่วไป", icon: UserRound },
  { key: "tax", label: "ข้อมูลภาษี", icon: Building2 },
  { key: "contact", label: "การติดต่อ", icon: Contact },
  { key: "address", label: "ที่อยู่", icon: MapPin },
  { key: "extra", label: "ข้อมูลเพิ่มเติม", icon: NotebookPen },
] as const;

export function BookingCustomerSummary({ value }: { value: BookingCustomerInput }) {
  return <div className="space-y-5">
    <h3 className="flex items-center gap-2 font-medium"><ClipboardCheck aria-hidden className="size-5 shrink-0" />ตรวจสอบข้อมูลก่อนบันทึก</h3>
    {sections.map(section => {
      const rows: { label: string; value: string | null | undefined }[] = [];
      if (section.key === "general") rows.push(
        { label: "ประเภทลูกค้า", value: value.customer_type === "juristic" ? "นิติบุคคล" : value.customer_type === "individual" ? "บุคคลธรรมดา" : null },
        { label: value.customer_type === "juristic" ? "ชื่อผู้ติดต่อ" : "ชื่อ", value: value.first_name },
        { label: "นามสกุล", value: value.last_name },
      );
      if (section.key === "contact") rows.push({ label: "เบอร์โทร", value: value.phone });
      if (section.key === "tax") rows.push({ label: "สำนักงาน", value: value.tax_head_office == null ? null : value.tax_head_office ? "สำนักงานใหญ่" : "สาขา" });
      for (const field of CUSTOMER_FIELDS.filter(field => field.group === section.key)) {
        const text = value[field.key];
        rows.push({ label: field.label, value: field.key === "preferred_language" ? text === "th" ? "ภาษาไทย" : text === "en" ? "อังกฤษ" : text : text });
      }
      if (section.key === "extra") rows.push({ label: "สถานะ VIP", value: value.vip_status == null ? null : value.vip_status ? "VIP" : "ทั่วไป" });
      return <section key={section.key} className="space-y-2 border-b pb-4 last:border-0">
        <h4 className="flex items-center gap-2 text-sm font-medium"><section.icon aria-hidden className="size-4 shrink-0" />{section.label}</h4>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">{rows.map(row => <div key={row.label} className="min-w-0"><dt className="text-muted-foreground">{row.label}</dt><dd className="whitespace-pre-wrap break-words">{row.value?.trim() || "ไม่ระบุ"}</dd></div>)}</dl>
      </section>;
    })}
  </div>;
}
