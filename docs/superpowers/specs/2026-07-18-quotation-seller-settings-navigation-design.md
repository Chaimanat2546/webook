# Quotation Seller Settings Navigation Design

**Date:** 2026-07-18
**Status:** Approved design, pending written-spec review

## Scope

ปรับหน้าตั้งค่าข้อมูลผู้ขายหลักโดยไม่เปลี่ยน schema หรือพฤติกรรม snapshot
ของใบเสนอราคาเดิม งานนี้ครอบคลุมเฉพาะ navigation, การจัดวางข้อมูล,
ข้อความภาษาไทย, การแสดงตัวอย่างโลโก้ และช่องหมายเหตุของธนาคารใน editor
เฉพาะใบ

## Navigation And Layout

- หน้าตั้งค่ามี sidebar สองเมนู:
  1. `ข้อมูลผู้ขายหลัก`
  2. `ช่องทางชำระเงิน`
- เมนูเป็น navigation จริง ไม่ใช่ anchor ที่เลื่อนหน้า
- ใช้ query parameter บน route เดิม:
  - ค่าเริ่มต้นหรือ `?section=company` แสดงข้อมูลผู้ขายหลัก
  - `?section=payments` แสดงช่องทางชำระเงิน
- Desktop ใช้ sidebar ซ้ายและ content ขวา โดยยึดรูปแบบ navigation
  ของ workspace หน้าอื่น แต่ไม่ใช้ House Workspace Shell เพราะไม่ใช่หน้าจัดการบ้าน
- Mobile และ tablet แปลง sidebar เป็นแถบเมนูแนวนอนที่เลือกได้
- แสดง content ของ section ที่เลือกเพียง section เดียว

## Seller Company Section

- รวมข้อมูลจดทะเบียน ที่อยู่ ช่องทางติดต่อ ผู้ติดต่อฝ่ายขาย และโลโก้
  ไว้ใน section `ข้อมูลผู้ขายหลัก`
- แสดงโลโก้ปัจจุบันให้เห็นชัดเจน หากยังไม่มีโลโก้ให้แสดง empty state
  ที่มีขนาดคงที่แทนข้อความลอย
- เมื่อเลือกไฟล์โลโก้ใหม่:
  - ตรวจชนิดและขนาดไฟล์ด้วย validation เดิม
  - แสดง local preview ทันทีโดยยังไม่อัปโหลดหรือบันทึก
  - เลือกไฟล์ใหม่แล้วแทน preview เดิม
  - ไฟล์ไม่ถูกต้องต้องคงโลโก้ที่บันทึกไว้และแสดงข้อผิดพลาด
  - คืน object URL เมื่อถูกแทนที่หรือ component ถูกถอด
- เมื่อบันทึกสำเร็จ ใช้ URL ที่ server ส่งกลับเป็นโลโก้ปัจจุบัน

## Payment Methods Section

- แสดงเฉพาะ master payment methods ของบัญชีปัจจุบัน
- คงการเพิ่ม ลบ ลากเรียง เลือกเป็นค่าเริ่มต้น อัปโหลดภาพ และบันทึก
  ตามพฤติกรรมเดิม
- ไม่เปลี่ยนข้อมูล snapshot ของใบเสนอราคาเก่า

## Per-Quotation Bank Editor

- ซ่อนช่อง `หมายเหตุ` เฉพาะเมื่อ:
  - editor อยู่ในโหมด `quotation`
  - ประเภทช่องทางเป็น `bank_transfer`
- master payment-method editor ยังคงแสดงและแก้ไขหมายเหตุธนาคารได้
- การซ่อนช่องเป็นการเปลี่ยน UI เท่านั้น ไม่ลบหมายเหตุเดิมโดยอัตโนมัติ
- ช่องหมายเหตุของ PromptPay, QR Payment, เงินสด และช่องทางอื่นยังคงแสดง

## Thai Copy

- เปลี่ยนข้อความที่ผู้ใช้เห็นในหน้าข้อมูลผู้ขายหลักและช่องทางชำระเงิน
  เป็นภาษาไทยที่เข้าใจง่าย
- ครอบคลุมหัวข้อ label ตัวเลือก ปุ่ม คำอธิบาย สถานะกำลังทำงาน
  ข้อความสำเร็จ empty state และข้อความผิดพลาดที่ component นี้สร้างเอง
- ใช้คำหลักให้สม่ำเสมอ เช่น:
  - `ชื่อบริษัท / ผู้ขาย`
  - `เลขประจำตัวผู้เสียภาษี`
  - `สำนักงานใหญ่` และ `สาขา`
  - `เลือกใช้ในใบเสนอราคาใหม่`
  - `บันทึกข้อมูลผู้ขาย` และ `บันทึกช่องทางชำระเงิน`
- ไม่เปลี่ยนข้อความจากระบบอื่นที่อยู่นอก flow นี้

## Accessibility And Responsive Behavior

- Navigation ใช้ link และระบุ active state ด้วย `aria-current="page"`
- Input ทุกช่องคง label, error association และ keyboard order
- Logo preview มี alternative text ที่สื่อความหมาย
- Mobile ต้องไม่มี horizontal overflow นอกแถบ navigation ที่ตั้งใจให้เลื่อน
- ปุ่มบันทึกปิดใช้งานระหว่างแปลงรูปหรือกำลังบันทึกตามเดิม

## Validation And Error Handling

- ใช้ validation และ upload action เดิม ไม่เพิ่ม dependency
- การสลับ section ไม่บันทึกข้อมูลอัตโนมัติ
- แต่ละ section ใช้ปุ่มบันทึกของตัวเอง
- Query `section` ที่ไม่รองรับให้ fallback ไป `company`

## Verification

- Component tests ตรวจ section navigation และ active state
- UI tests ตรวจข้อความภาษาไทยและการแสดง content ทีละ section
- Regression test ตรวจว่า bank note ถูกซ่อนเฉพาะ quotation bank transfer
- Component test ตรวจ local logo preview และการคืน object URL
- รัน typecheck, lint, tests และ build
- ตรวจ rendered layout ที่ mobile, tablet, laptop และ desktop

## Out Of Scope

- ไม่แยก route ใหม่หลายหน้า
- ไม่แก้ schema, RLS หรือ payment snapshot behavior
- ไม่เปลี่ยน House Workspace Shell
- ไม่เพิ่มระบบลบโลโก้
