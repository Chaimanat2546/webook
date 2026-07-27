# Quotation Module UX Polish Design

**Date:** 2026-07-21

**Status:** Approved for implementation planning

## Goal

ปรับประสบการณ์ใช้งานของโมดูลใบเสนอราคาให้สอดคล้องกับหน้า Admin อื่น อ่านง่าย ใช้พื้นที่สมเหตุผล และรองรับ Mobile ถึง Desktop โดยไม่เปลี่ยน Business Logic, API, Database Schema, สูตรคำนวณ หรือพฤติกรรม Snapshot ที่ใช้อยู่

งานแบ่งตาม User Journey เป็น 4 MVP เพื่อให้พัฒนาและตรวจรับได้ทีละส่วน:

1. รายการใบเสนอราคาและการนำทาง
2. หน้าสร้างและแก้ไขแบบ Document Workbench
3. ตั้งค่าผู้ขาย ช่องทางชำระเงิน และการรับรอง
4. Preview, Print, PDF และ Public Read-only

## Shared Design Principles

- ใช้ Admin Shell และ UI primitives ที่มีอยู่แล้ว ไม่สร้าง Design System หรือ Layout abstraction ใหม่
- ใช้กริดที่ชัดเจนและกำหนดความกว้างตามชนิดข้อมูล ไม่ยืดทุก Input ให้เต็มพื้นที่
- ลด Card ซ้อน Card; ใช้หัวข้อ ช่องว่าง และเส้นแบ่งเป็นลำดับชั้นหลัก
- ปุ่มหลักและปุ่มรองต้องมีลำดับความสำคัญชัดเจนและอยู่ตำแหน่งสม่ำเสมอ
- ออกแบบ Mobile-first และตรวจที่ Mobile, Tablet, Laptop และ Desktop
- รักษา Keyboard navigation, visible focus, label association และ touch target ที่เหมาะสม
- ข้อความ UI ใช้ภาษาไทยที่สั้นและเข้าใจง่าย โดยไม่เปลี่ยนความหมายของข้อมูล
- ไม่มีการเพิ่ม dependency สำหรับงาน UX polish นี้

## Shared Notice And Form Feedback

ใช้รูปแบบเดียวกับหน้า Admin อื่นและรูปแบบที่โมดูลมีอยู่แล้ว:

- ใช้ Toast แจ้งผลสำเร็จหรือข้อผิดพลาดระดับงาน เช่น บันทึก ลบ อัปโหลด ดาวน์โหลด และสร้าง PDF
- Error ที่ผูกกับข้อมูลช่องใดช่องหนึ่งแสดงใต้ Input นั้น ไม่ใช้ Toast แทน field error
- เมื่อส่งฟอร์มไม่ผ่าน ให้เลื่อนและโฟกัสช่องแรกที่ผิด พร้อมคงค่าที่ผู้ใช้กรอกไว้
- ระหว่างทำงาน ให้ปิดเฉพาะปุ่มที่เกี่ยวข้องและเปลี่ยนข้อความ เช่น `กำลังบันทึก…` หรือ `กำลังสร้าง PDF…`
- ใช้ Empty state ที่บอกสาเหตุและมี Next action ที่เหมาะสม
- ใช้ Error state ในพื้นที่เนื้อหาพร้อมปุ่ม `ลองใหม่` เมื่อโหลดข้อมูลไม่สำเร็จ
- เตือนผู้ใช้ก่อนออกจากหน้าหรือเปลี่ยน Section เมื่อมีข้อมูลที่แก้แล้วแต่ยังไม่บันทึก
- ไม่เพิ่ม Notification Center หรือระบบเก็บประวัติการแจ้งเตือน

## MVP 1: Quotation List And Navigation

### Scope

ปรับหน้ารายการใบเสนอราคา การค้นหา การเข้าสู่หน้าสร้าง/แก้ไข และ Feedback ของการลบ โดยไม่เปลี่ยน Query, สิทธิ์ หรือ Soft-delete behavior

### Layout

- Page header ใช้รูปแบบเดียวกับหน้า Admin อื่น: ชื่อหน้า คำอธิบายสั้น และปุ่ม `สร้างใบเสนอราคา`
- Desktop และ Tablet แสดงตารางเต็มความกว้าง โดยกำหนดคอลัมน์ตามปริมาณข้อมูล
- ตารางแสดงข้อมูลที่ List API มีอยู่แล้ว ได้แก่ เลขที่เอกสาร ลูกค้า วันที่ออก วันที่ใช้ได้ถึง ยอดสุทธิ และเมนูจัดการ; ไม่เพิ่มคอลัมน์เรื่อง/ชื่องานเพราะจะทำให้ต้องเปลี่ยน RPC contract
- Mobile เปลี่ยนแต่ละแถวเป็นรายการแนวตั้งแบบกะทัดรัด ไม่บีบตารางหรือสร้าง page-level horizontal scroll
- Sidebar และ navigation ใช้รูปแบบเดิมของ Admin Shell

### Interaction

- คลิกพื้นที่หลักของแถวเพื่อเปิดใบเสนอราคา
- เมนูจัดการเป็น control แยกและไม่ trigger การเปิดแถวโดยไม่ตั้งใจ
- ค้นหาได้จากเลขที่เอกสาร ชื่อลูกค้า เลขอ้างอิง และเรื่อง/ชื่องานตามความสามารถของระบบเดิม แม้เรื่อง/ชื่องานจะไม่แสดงเป็นคอลัมน์
- การลบต้องมี confirmation และแจ้งผลผ่าน Toast
- ระหว่างโหลดใช้ Skeleton ที่รักษาขนาดโดยประมาณของตาราง
- เมื่อไม่มีข้อมูล แสดงคำอธิบายพร้อมปุ่มสร้างใบเสนอราคาแรก
- เมื่อโหลดไม่สำเร็จ แสดง Error state ในพื้นที่รายการพร้อมปุ่มลองใหม่

### Acceptance Criteria

- หน้ารายการไม่มี page-level horizontal overflow ที่ Mobile
- ผู้ใช้ค้นหา เปิด สร้าง และลบเอกสารได้ด้วยพฤติกรรมเดิม
- Loading, empty, error และ delete result มี Feedback ที่ชัดเจน
- Keyboard focus และชื่อ accessible ของ action controls ถูกต้อง

## MVP 2: Create And Edit Document Workbench

### Scope

ปรับลำดับชั้น ความหนาแน่น Responsive layout และ Form feedback ของหน้าสร้าง/แก้ไข โดยไม่เปลี่ยน payload, validation rule, สูตรคำนวณ หรือการบันทึก

### Composition

Header แสดง `ใบเสนอราคาใหม่` หรือเลขที่เอกสาร พร้อมปุ่มย้อนกลับ, Preview และบันทึก จากนั้นเรียงเนื้อหาตามขั้นตอนทำงาน:

1. ลูกค้า
2. ข้อมูลเอกสาร
3. รายการ
4. หมายเหตุและยอดสรุป
5. Tab ช่องทางชำระเงินและการรับรอง

Desktop ใช้พื้นที่เต็มความกว้างตาม Document Workbench เดิม ส่วน Mobile เรียง Section เป็นแนวตั้ง ปุ่มงานหลักเข้าถึงได้จากแถบคำสั่งด้านล่างโดยไม่บังเนื้อหา

### Fields And Item Grid

- ช่องกรอกใช้ความกว้างตามข้อมูลจริง; ช่องสั้นไม่ขยายเท่าช่องชื่อหรือที่อยู่
- คอลัมน์รายการ/รายละเอียดเป็นคอลัมน์ยืดหลัก
- จำนวน หน่วย ราคา ส่วนลด และ VAT ใช้ความกว้างจำกัดตามข้อมูลที่รับจริง
- Mobile แสดงแต่ละรายการเป็นบล็อก ไม่ย่อทุกฟิลด์ลงในตารางแคบ
- Drag handle มองเห็นและกดได้ชัด พร้อมทางเลือก Keyboard สำหรับเลื่อนลำดับ
- การตั้งค่า `ส่วนลดต่อรายการ` และ `VAT ต่อรายการ` ปิดและซ่อนเป็นค่าเริ่มต้นตามพฤติกรรมเดิม
- จำนวนเงินใน Display และ Input ใช้ comma และทศนิยมสองตำแหน่งตามกติกาปัจจุบัน

### Feedback And Safety

- Error แสดงใต้ Input และโฟกัสช่องแรกที่ผิด
- การบันทึกแจ้งผลผ่าน Toast และป้องกันการส่งซ้ำระหว่าง Pending
- ข้อมูลที่ยังไม่บันทึกต้องไม่หายจาก validation error
- เตือนก่อนออกจากหน้าหากฟอร์ม Dirty
- Preview ยังคงใช้ข้อมูล Draft ตามพฤติกรรมเดิม

### Acceptance Criteria

- ไม่มี Input ที่ยืดเกินหน้าที่ของข้อมูลโดยไม่มีเหตุผล
- ตารางรายการใช้งานได้ที่ Mobile โดยไม่มี page-level horizontal overflow
- การเพิ่ม ลบ ลากเรียง และตั้งค่ารายการทำงานเหมือนเดิม
- ยอดทุกจุดตรงกับสูตรเดิม และ Format เงินสม่ำเสมอ
- Save, validation และ unsaved warning ให้ Feedback ครบถ้วน

## MVP 3: Seller, Payment, And Certification Settings

### Scope

ปรับหน้า Settings และสาม Section ที่มีอยู่ โดยไม่เปลี่ยน ownership, User linkage, Snapshot, RLS, Upload API หรือ Database Schema

### Workspace Navigation

- Page header ใช้ปุ่มย้อนกลับ ชื่อหน้า และคำอธิบายแบบเดียวกับหน้า Admin อื่น
- Desktop ใช้ Sidebar ภายใน Workspace
- Mobile ใช้ Tab แนวนอนที่เลื่อนได้และมี active state ชัดเจน
- คง Section เดิม: `ข้อมูลผู้ขายหลัก`, `ช่องทางชำระเงิน`, `ข้อมูลรับรองหลัก`
- การเปลี่ยน Section ไม่บันทึกข้อมูลอัตโนมัติ และเตือนเมื่อ Section ปัจจุบันมีข้อมูลยังไม่บันทึก

### Seller Profile

- ลด Card ซ้อน Card และแบ่งกลุ่มด้วย heading, spacing และ separator
- ชื่อบริษัทและที่อยู่ใช้พื้นที่กว้าง
- เลขประจำตัวผู้เสียภาษี เบอร์โทร ประเภทสำนักงาน และเลขสาขาใช้ช่องตามความยาวข้อมูล
- เลขสาขาแสดงเฉพาะเมื่อเลือก `สาขา`
- โลโก้แสดง Local preview ทันทีหลังเลือกไฟล์และก่อนบันทึก

### Payment Methods

- ใช้ Card เฉพาะรายการช่องทางชำระเงินที่เพิ่ม ลบ หรือเรียงลำดับได้
- ไม่วางทุกช่องเป็นคอลัมน์กว้างเท่ากัน; ชื่อบัญชีและรายละเอียดที่ยาวได้ใช้พื้นที่มากกว่า account type หรือเลขบัญชี
- Header controls ต้อง wrap ได้โดยไม่ชนกัน
- Breakpoint ระดับ Tablet ต้องไม่บีบฟอร์มห้าคอลัมน์ลงในพื้นที่แคบ

### Certification

- ผู้ออกเอกสารและผู้อนุมัติเรียงสองคอลัมน์ตั้งแต่ Tablet และซ้อนเป็นแนวตั้งที่ Mobile
- ลดน้ำหนักเส้นของ Fieldset และจัด Preview ลายเซ็นให้อยู่ใกล้ Input ของผู้ลงนาม
- ตราประทับใช้ asset row แบบกะทัดรัด
- ลายเซ็นและตราประทับแสดง Local preview ก่อนบันทึก

### Actions And Feedback

- แต่ละ Section มี Action footer แยกจากเนื้อหา: สถานะอยู่ซ้าย ปุ่มบันทึกขนาดตามข้อความอยู่ขวา
- ปุ่มบันทึกเต็มความกว้างเฉพาะ Mobile
- ปิดปุ่มที่เกี่ยวข้องระหว่างบันทึกหรืออัปโหลด
- Upload error แสดงใกล้ช่องไฟล์และมี Toast สรุป
- Field error แสดงใต้ Input และโฟกัสช่องแรกที่ผิด

### Acceptance Criteria

- Navigation ใช้งานได้ด้วย Keyboard และระบุ active state อย่างถูกต้อง
- ไม่มี page-level horizontal overflow; horizontal scroll อนุญาตเฉพาะ Mobile tab navigation ที่ตั้งใจไว้
- Local asset preview แสดงก่อนบันทึก และ upload failure ไม่ลบค่าที่บันทึกเดิม
- Seller, payment และ certification save behavior ยังคงแยกจากกัน
- Layout ผ่านการตรวจที่ Mobile, Tablet, Laptop และ Desktop

## MVP 4: Preview, Print, PDF, And Public Read-only

### Scope

ปรับความสอดคล้อง การอ่าน การตัดคำ การแบ่งหน้า และ Feedback ของเอกสารทุก Surface โดยไม่เพิ่มสถานะเอกสาร การตอบรับ ลายเซ็นออนไลน์ หรือ Payment flow

### Shared Document Presentation

- ใช้ normalized document view model เดิมเป็นแหล่งข้อมูลร่วมของ Preview, Print, PDF และ Public Read-only
- โครงสร้างข้อมูล ลำดับ Section จำนวนเงิน และ optional content ต้องสอดคล้องกันทุก Surface
- Preview บนหน้าจอใช้พื้นที่ Responsive; A4 เป็นข้อกำหนดเฉพาะ Print/PDF และการแสดงเอกสารที่ตั้งใจจำลองกระดาษ
- ปุ่ม Share, Print และ Download เป็น Screen-only controls และไม่ปรากฏในเอกสาร
- Mobile Public View เรียงข้อมูลให้อ่านได้โดยไม่เปลี่ยนเนื้อหาหรือยอด

### Typography And Pagination

- ข้อความไทยและคำอังกฤษยาวติดกันต้อง wrap ภายในคอลัมน์และไม่ถูกตัดตัวอักษร
- จำนวนเงินชิดขวา มี comma และทศนิยมสองตำแหน่ง
- Header ของตารางต้องไม่แยกจากเนื้อหาแรกโดยไม่จำเป็น
- หลีกเลี่ยงการตัดแถวรายการ กลุ่มชำระเงิน และส่วนรับรองกลางบล็อกเมื่อ Engine รองรับ
- ไม่มีหน้าว่างท้ายเอกสาร
- Print CSS ต้องรักษาสีพื้น เส้น และโลโก้ด้วย `print-color-adjust`

### Saved-state Rules

- Share และ Download ใช้ได้เฉพาะใบที่บันทึกแล้วและไม่มีการแก้ไขค้าง
- Public Read-only แสดงเฉพาะข้อมูลล่าสุดที่บันทึกสำเร็จ
- เอกสารใหม่หรือ Saved-dirty ต้องบันทึกก่อนจึงใช้ Share/Download ได้
- Public token ที่ไม่ถูกต้อง ถูกลบ หรือเข้าถึงไม่ได้ แสดงสถานะไม่พบเอกสารโดยไม่เปิดเผยข้อมูลภายใน

### Feedback

- ระหว่างสร้าง PDF ปิดปุ่ม Download และแสดง `กำลังสร้าง PDF…`
- Print/PDF/Share failure แจ้งผ่าน Toast และเปิดให้ลองใหม่
- Failure ต้องไม่ดาวน์โหลดไฟล์บางส่วนหรือเปลี่ยนข้อมูลใบเสนอราคา

### Acceptance Criteria

- Preview, Print, PDF และ Public แสดงข้อมูลที่รองรับตรงกัน
- เอกสารตัวอย่างที่มีข้อความไทยยาว คำอังกฤษไม่เว้นวรรค หลายรายการ และหลายหน้าไม่ล้นหรือทับกัน
- Print/PDF ไม่มีหน้าว่างท้ายเอกสารและมีสีตามแบบ
- Public route ไม่ต้องเข้าสู่ระบบและไม่แสดง Admin controls หรือ internal notes
- Share/Download availability ตรงกับ saved-clean state

## Implementation Sequence

ทำตามลำดับ MVP 1 ถึง MVP 4 โดยแต่ละ MVP ต้องมี Implementation Plan, verification และ review ของตัวเองก่อนเริ่ม MVP ถัดไป การแก้ Shared primitive ทำได้เฉพาะเมื่อมีของเดิมให้ reuse และช่วยลดความไม่สม่ำเสมอจริง ห้ามสร้าง abstraction ล่วงหน้าสำหรับ MVP ที่ยังไม่เริ่ม

## Verification Strategy

แต่ละ MVP ต้องตรวจเท่าที่เกี่ยวข้อง:

- Component/unit tests สำหรับ state และ interaction ที่มี regression risk
- Regression tests สำหรับ validation, amount formatting, saved/dirty gating และ document wrapping ตามขอบเขต MVP
- Manual visual check ที่ Mobile, Tablet, Laptop และ Desktop
- Keyboard-only navigation และ visible focus
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build` เมื่อจบแต่ละ MVP หรือเมื่อมีการเปลี่ยน rendering/bundling ที่เกี่ยวข้อง

## Out Of Scope

- Database migration, RLS, API contract หรือสูตรคำนวณใหม่
- ข้อมูลลูกค้า, document workflow, status, approval action หรือ revision history
- Online acceptance, electronic signature หรือ payment collection
- Notification Center
- Autosave
- Design System, generic form builder หรือ generic document renderer ใหม่
- การเปลี่ยน UX ของโมดูลบ้านพักหรือโฆษณา
