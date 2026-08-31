import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { WEBOOK_ALLOW_TOOL_OPTIONS } from "../lib/webook-users.ts";

describe("Webook allow tools", () => {
  it("uses the approved Thai labels, descriptions, and icons", () => {
    assert.deepEqual(WEBOOK_ALLOW_TOOL_OPTIONS, [
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
    ]);
  });
});
