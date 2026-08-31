export interface WebookManagedRole {
  id: number;
  name: string;
}

export const WEBOOK_ALLOW_TOOL_OPTIONS = [
  { key: "allow_cost", label: "ตรวจสอบราคาส่ง", description: "ดูราคาส่งของเอเจนซี่" },
  { key: "allow_price", label: "กำหนดราคา", description: "กำหนดราคาบ้านพัก" },
  { key: "allow_report", label: "รายงานการจองที่พัก", description: "ดูรายงานการจองที่พัก" },
  { key: "allow_billing", label: "ออกบิล", description: "สร้างและจัดการบิล" },
  { key: "allow_booking", label: "จองบ้านพูลวิลล่า", description: "จัดการการจองบ้านพัก" },
  { key: "allow_invoice", label: "ออกใบแจ้งหนี้", description: "สร้างและจัดการใบแจ้งหนี้" },
  { key: "allow_members", label: "จัดการสมาชิก", description: "จัดการข้อมูลสมาชิก" },
  { key: "allow_receipt", label: "ออกใบเสร็จ", description: "สร้างและจัดการใบเสร็จ" },
  { key: "allow_quotation", label: "ออกใบเสนอราคา", description: "สร้างและจัดการใบเสนอราคา" },
  { key: "allow_tax_invoice", label: "ออกใบกำกับภาษี", description: "สร้างและจัดการใบกำกับภาษี" },
  { key: "allow_accommodation", label: "แก้ไขข้อมูลบ้าน", description: "จัดการข้อมูลบ้านพัก" },
] as const;

export type WebookAllowTool = (typeof WEBOOK_ALLOW_TOOL_OPTIONS)[number]["key"];
export type WebookAllowTools = Record<WebookAllowTool, boolean>;

export interface WebookManagedUser {
  allowTools?: WebookAllowTools;
  dvId?: string | null;
  email: string;
  id: string;
  name: string;
  roleId: number | null;
  username: string;
}
