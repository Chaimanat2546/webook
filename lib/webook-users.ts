export interface WebookManagedRole {
  id: number;
  name: string;
}

export const WEBOOK_ALLOW_TOOL_OPTIONS = [
  { key: "allow_cost", label: "ตรวจสอบราคาส่ง", description: "ดูราคาส่งของเอเจนซี่", icon: "BanknoteIcon" },
  { key: "allow_price", label: "กำหนดราคา", description: "กำหนดราคาบ้านพัก", icon: "BadgeDollarSign" },
  { key: "allow_report", label: "รายงานการจองที่พัก", description: "ดูรายงานการจองที่พัก", icon: "MdAssessment" },
  { key: "allow_billing", label: "ออกบิล", description: "สร้างและจัดการบิล", icon: "MdReceiptLong" },
  { key: "allow_booking", label: "จองบ้านพูลวิลล่า", description: "จัดการการจองบ้านพัก", icon: "MdEventAvailable" },
  { key: "allow_invoice", label: "ออกใบแจ้งหนี้", description: "สร้างและจัดการใบแจ้งหนี้", icon: "FaFileInvoiceDollar" },
  { key: "allow_members", label: "จัดการสมาชิก", description: "จัดการข้อมูลสมาชิก", icon: "Users" },
  { key: "allow_receipt", label: "ออกใบเสร็จ", description: "สร้างและจัดการใบเสร็จ", icon: "MdReceipt" },
  { key: "allow_quotation", label: "ออกใบเสนอราคา", description: "สร้างและจัดการใบเสนอราคา", icon: "FileText" },
  { key: "allow_tax_invoice", label: "ออกใบกำกับภาษี", description: "สร้างและจัดการใบกำกับภาษี", icon: "TbReceiptTax" },
  { key: "allow_accommodation", label: "แก้ไขข้อมูลบ้าน", description: "จัดการข้อมูลบ้านพัก", icon: "House" },
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
