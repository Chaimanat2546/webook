# Webook User Manuals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Project override: `webook_explorer` and `webook_reviewer` are read-only; only the main agent may edit files.

**Goal:** จัดทำคู่มือภาษาไทยพร้อมภาพหน้าจอใส่หมายเลขสำหรับ User Flow หลักทั้ง 5 Flow ของ Webook

**Architecture:** คู่มือแต่ละ Flow เป็น bundle อิสระหนึ่งโฟลเดอร์ ประกอบด้วย `README.md`, ภาพต้นฉบับ และภาพใส่หมายเลข สร้างคู่มือใหม่ 4 bundle และปรับปรุง bundle ใบเสนอราคาที่มีอยู่ โดยรวม Public Link ไว้ใน Flow ใบเสนอราคา

**Tech Stack:** Markdown, PNG screenshots, Next.js UI ปัจจุบัน, browser capture และ image editing tools ที่มีอยู่ใน Codex

## Global Constraints

- เนื้อหาทั้งหมดเป็นภาษาไทยสำหรับผู้ใช้ระบบครั้งแรก
- หนึ่ง User Flow มีไฟล์ Markdown เพียงหนึ่งไฟล์
- อธิบายเฉพาะพฤติกรรมที่ตรวจพบใน UI และโค้ดปัจจุบัน ห้ามคาดเดาฟีเจอร์
- ใช้ข้อมูลตัวอย่างเท่านั้น และต้องไม่แสดงอีเมล เบอร์โทร เลขบัญชี token หรือข้อมูลลูกค้าจริง
- Admin screenshots ใช้ viewport เดียวกันตลอดชุด; หน้า Public เพิ่ม mobile screenshot เมื่อ layout ต่างจาก desktop
- ภาพต้นฉบับอยู่ใน `assets/source/`; ภาพใส่หมายเลขอยู่ใน `assets/annotated/`
- ทุกหมายเลขบนภาพต้องมีคำอธิบายใต้ภาพ และทุกภาพต้องมี alt text ภาษาไทย
- ห้ามเพิ่ม dependency หรือแก้โค้ดแอปเพื่อทำคู่มือ
- ไม่สร้าง PDF คู่มือใหม่ และไม่ลบ PDF ใบเสนอราคาที่มีอยู่
- ก่อนแก้ไฟล์ให้ใช้ `webook_explorer` ตรวจระบบแบบ read-only; หลังแก้เสร็จใช้ `webook_reviewer` รีวิวแบบ read-only

---

### Task 0: ตรวจเส้นทางจริงและเตรียมข้อมูลตัวอย่าง

**Files:**
- Read: `app/login/**`
- Read: `app/admin/houses/**`
- Read: `app/admin/advertisements/**`
- Read: `app/admin/quotations/**`
- Read: `app/q/[token]/**`
- Read: `components/admin/**`
- Read: `docs/manuals/quotation/README.md`

**Interfaces:**
- Consumes: design spec `docs/superpowers/specs/2026-07-22-user-manuals-design.md`
- Produces: รายการชื่อเมนู ปุ่ม validation, error state, permission state และ screenshot state ที่ยืนยันจากระบบจริง

- [ ] **Step 1: ส่ง `webook_explorer` ตรวจระบบแบบ read-only**

ขอให้รายงานแยก 5 Flow โดยระบุ route, ชื่อปุ่ม/ช่องที่ผู้ใช้เห็น, happy path, validation, error state และ permission state ห้ามแก้ไฟล์ ติดตั้ง dependency หรือเปลี่ยนข้อมูล remote

- [ ] **Step 2: เทียบผลกับ design spec**

ยืนยันว่า Public Link เป็นส่วนหนึ่งของ Flow ใบเสนอราคา และไม่มีหน้าหรือฟีเจอร์นอก 5 Flow หลุดเข้ามา หาก UI ปัจจุบันขัดกับ design spec ให้ยึด UI จริงและบันทึกความต่างก่อนเขียนคู่มือ

- [ ] **Step 3: เตรียม session สำหรับถ่ายภาพ**

ใช้ local หรือ staging ที่มีบัญชีทดสอบและข้อมูลตัวอย่าง ครบทั้งสถานะสำเร็จและสถานะผิดพลาดที่ต้องอธิบาย ห้ามใช้ production data หากไม่สามารถเปิดสถานะสำคัญได้ ให้หยุดและขอ test data แทนการสร้างภาพจำลอง

- [ ] **Step 4: กำหนดมาตรฐานภาพหนึ่งครั้ง**

ใช้ viewport Admin เดียวกันตลอดชุด ตั้งชื่อภาพตามรายการในแต่ละ Task และตรวจว่าภาพไม่มีข้อมูลลับก่อนบันทึก

---

### Task 1: คู่มือเข้าสู่ระบบและจัดการรหัสผ่าน

**Files:**
- Create: `docs/manuals/authentication/README.md`
- Create: `docs/manuals/authentication/assets/source/01-login.png`
- Create: `docs/manuals/authentication/assets/source/02-login-error.png`
- Create: `docs/manuals/authentication/assets/source/03-forgot-password.png`
- Create: `docs/manuals/authentication/assets/source/04-reset-password.png`
- Create: `docs/manuals/authentication/assets/source/05-sign-out.png`
- Create: matching files under `docs/manuals/authentication/assets/annotated/` with `-annotated` suffix
- Read: `app/login/page.tsx`
- Read: `app/login/actions.ts`
- Read: `app/login/password-reset-request-form.tsx`
- Read: `app/login/reset-password/page.tsx`
- Read: `components/layout/admin-shell.tsx`

**Interfaces:**
- Consumes: route/button/error inventory from Task 0
- Produces: คู่มือ Flow Authentication ที่ใช้ได้ตั้งแต่ login ถึง logout/reset password

- [ ] **Step 1: เดิน Flow และบันทึกข้อความจริง**

ตรวจ login สำเร็จ, login ผิด, forgot password, reset password, logout และกรณี login ได้แต่ไม่มีเมนู จดข้อความที่ UI แสดงตามจริง ห้ามใส่รายละเอียด SMTP หรือ Supabase ในคู่มือผู้ใช้

- [ ] **Step 2: ถ่ายภาพต้นฉบับ 5 ภาพ**

บันทึกตามชื่อไฟล์ที่ระบุในส่วน Files ใช้ข้อมูลทดสอบและปิดบังอีเมลในภาพ forgot/reset หากปรากฏ

- [ ] **Step 3: สร้างภาพใส่หมายเลข 5 ภาพ**

แก้จากภาพต้นฉบับโดยคง UI เดิม เพิ่มเฉพาะหมายเลข กรอบ หรือลูกศรที่จำเป็น แล้วตรวจภาพด้วย `view_image` ก่อนอ้างอิงใน Markdown

- [ ] **Step 4: เขียนคู่มือด้วยโครงหัวข้อมาตรฐาน**

ใช้หัวข้อตามนี้และเติมรายละเอียดจาก UI จริง:

```markdown
# คู่มือเข้าสู่ระบบและจัดการรหัสผ่าน

> ตรวจสอบล่าสุด: 22 กรกฎาคม 2026

## คู่มือนี้ใช้สำหรับใคร
## ก่อนเริ่ม
## ภาพรวมการทำงาน
## 1. เข้าสู่ระบบ
## 2. เมื่อลืมรหัสผ่าน
## 3. ตั้งรหัสผ่านใหม่
## 4. ออกจากระบบ
## ผลลัพธ์ที่ควรเห็น
## เมื่อใช้งานไม่ได้
## Checklist ก่อนจบงาน
```

ตารางปัญหาต้องมีอย่างน้อย: ข้อมูลเข้าสู่ระบบไม่ถูกต้อง, ไม่ได้รับอีเมล, ลิงก์หมดอายุ และไม่เห็นเมนูหลัง login

- [ ] **Step 5: ตรวจคู่มือกับระบบจริง**

ทำตามคู่มือจากต้นจนจบ ตรวจชื่อปุ่ม alt text คำอธิบายหมายเลข และลิงก์ภาพทุกไฟล์

- [ ] **Step 6: Commit คู่มือ Authentication**

```powershell
git add -- docs/manuals/authentication
git commit -m "docs: add authentication user manual"
```

---

### Task 2: คู่มือจัดการข้อมูลบ้าน

**Files:**
- Create: `docs/manuals/house-management/README.md`
- Create: source and annotated pairs for `01-house-list.png`, `02-house-actions.png`, `03-details.png`, `04-prices.png`, `05-facilities.png`, `06-save-confirmation.png` under `docs/manuals/house-management/assets/`
- Read: `app/admin/houses/page.tsx`
- Read: `app/admin/houses/[propertyId]/page.tsx`
- Read: `app/admin/houses/[propertyId]/actions.ts`
- Read: `components/admin/houses/house-list.tsx`
- Read: `components/admin/houses/house-workspace-shell.tsx`

**Interfaces:**
- Consumes: house route, permission และ validation inventory from Task 0
- Produces: คู่มือค้นหาและแก้ไขรายละเอียด ราคา และสิ่งอำนวยความสะดวกของบ้าน

- [ ] **Step 1: เดิน Flow บ้านครบทุก section**

ตรวจรายการบ้าน การค้นหา pagination เมนูต่อบ้าน และ Workspace sections `details`, `prices`, `facilities` รวมสถานะช่องที่แก้ไม่ได้และข้อความหลังบันทึก

- [ ] **Step 2: ถ่ายและใส่หมายเลขภาพ 6 คู่**

ใช้ชื่อใน Files ภาพ `06-save-confirmation` ต้องเห็นข้อความยืนยันจริงโดยไม่บดบังบริบทของ section ที่เพิ่งบันทึก

- [ ] **Step 3: เขียนคู่มือ**

```markdown
# คู่มือจัดการข้อมูลบ้าน

> ตรวจสอบล่าสุด: 22 กรกฎาคม 2026

## คู่มือนี้ใช้สำหรับใคร
## ก่อนเริ่ม
## ภาพรวมการทำงาน
## 1. ค้นหาและเลือกบ้าน
## 2. แก้ไขข้อมูลทั่วไป
## 3. แก้ไขราคา
## 4. แก้ไขสิ่งอำนวยความสะดวก
## 5. บันทึกและตรวจผลลัพธ์
## เมื่อใช้งานไม่ได้
## Checklist ก่อนจบงาน
```

ระบุให้ชัดว่าช่องใดถูกปิดตามสิทธิ์โดยอธิบายจากมุมผู้ใช้ ไม่อธิบาย role id หรือ RLS ตารางปัญหาต้องมี: ค้นหาไม่พบ, บันทึกไม่ได้, ช่องแก้ไม่ได้ และข้อมูลไม่เปลี่ยนหลังบันทึก

- [ ] **Step 4: ตรวจทั้ง desktop และ mobile navigation**

คู่มือหลักใช้ภาพ Admin viewport ที่กำหนด แต่ต้องยืนยันว่าคำอธิบายการเลือก section ยังใช้ได้บน mobile horizontal sidebar โดยไม่ต้องเพิ่มภาพหากลำดับการใช้งานเหมือนกัน

- [ ] **Step 5: Commit คู่มือ House Management**

```powershell
git add -- docs/manuals/house-management
git commit -m "docs: add house management user manual"
```

---

### Task 3: คู่มือจัดการรูปภาพบ้าน

**Files:**
- Create: `docs/manuals/house-images/README.md`
- Create: source and annotated pairs for `01-zone-navigation.png`, `02-upload-control.png`, `03-upload-success.png`, `04-single-delete.png`, `05-bulk-delete.png`, `06-cover-selection.png` under `docs/manuals/house-images/assets/`
- Read: `app/admin/houses/[propertyId]/images/page.tsx`
- Read: `app/admin/houses/[propertyId]/images/actions.ts`
- Read: `components/admin/images/image-zone-viewer.tsx`
- Read: `components/admin/images/cover-select-viewer.tsx`
- Read: `server/services/images.ts`

**Interfaces:**
- Consumes: house image states and validation inventory from Task 0
- Produces: คู่มือจัดการรูปตามโซน อัปโหลด ลบ และเลือกรูปปก

- [ ] **Step 1: เดิน Flow รูปภาพครบทุกการเปลี่ยนสถานะ**

ตรวจเลือกโซน, upload สำเร็จ, single delete confirmation, bulk selection/delete และ cover selection ระบุข้อจำกัดตามข้อความ UI จริง รวมความต่างของรูปเดิมที่ลบไม่ได้หาก UI แสดงสถานะนั้น

- [ ] **Step 2: ถ่ายและใส่หมายเลขภาพ 6 คู่**

ภาพยืนยันลบต้องใช้รูปตัวอย่างที่ไม่มีข้อมูลลูกค้า ภาพ bulk delete ต้องเห็นขอบเขตว่าเลือกเฉพาะโซนปัจจุบัน และภาพ cover selection ต้องเห็นลำดับที่ผู้ใช้ควบคุมได้จริง

- [ ] **Step 3: เขียนคู่มือ**

```markdown
# คู่มือจัดการรูปภาพบ้าน

> ตรวจสอบล่าสุด: 22 กรกฎาคม 2026

## คู่มือนี้ใช้สำหรับใคร
## ก่อนเริ่ม
## ภาพรวมการทำงาน
## 1. เลือกบ้านและโซนรูปภาพ
## 2. อัปโหลดรูป
## 3. ลบรูปเดี่ยว
## 4. ลบหลายรูป
## 5. เลือกและจัดรูปปก
## ผลลัพธ์ที่ควรเห็น
## เมื่อใช้งานไม่ได้
## Checklist ก่อนจบงาน
```

ตารางปัญหาต้องมี: รูปไม่แสดง, ไฟล์ไม่รองรับ, upload ไม่สำเร็จ, ลบไม่ได้ และเลือกรูปปกไม่ได้ โดยใช้ข้อจำกัดชนิด/ขนาดไฟล์ที่ UI แสดงจริง

- [ ] **Step 4: ทดสอบคำเตือนงานที่ย้อนกลับไม่ได้**

ยืนยันว่าคู่มือบอกให้ตรวจรูปและโซนก่อนกดยืนยันลบ ไม่เขียนว่ากู้คืนได้หากระบบไม่มีความสามารถนั้น

- [ ] **Step 5: Commit คู่มือ House Images**

```powershell
git add -- docs/manuals/house-images
git commit -m "docs: add house image user manual"
```

---

### Task 4: คู่มือจัดการโฆษณา

**Files:**
- Create: `docs/manuals/advertisements/README.md`
- Create: source and annotated pairs for `01-list.png`, `02-create-form.png`, `03-display-zone.png`, `04-image-upload.png`, `05-edit-images.png`, `06-save-feedback.png` under `docs/manuals/advertisements/assets/`
- Read: `app/admin/advertisements/page.tsx`
- Read: `app/admin/advertisements/new/page.tsx`
- Read: `app/admin/advertisements/[id]/page.tsx`
- Read: `app/admin/advertisements/actions.ts`
- Read: `components/admin/advertisements/advertisement-form.tsx`
- Read: `server/services/advertisements.ts`

**Interfaces:**
- Consumes: advertisement field, image limit และ validation inventory from Task 0
- Produces: คู่มือสร้าง แก้ไข และจัดการรูปโฆษณา

- [ ] **Step 1: เดิน Flow สร้างและแก้ไขโฆษณา**

ตรวจ list, create, display zone/type controls, upload, edit, image delete และ save feedback จดชื่อ field และข้อจำกัดรูปตาม UI จริง

- [ ] **Step 2: ถ่ายและใส่หมายเลขภาพ 6 คู่**

ภาพ error/success ใช้ข้อความที่ระบบสร้างจริง ห้ามตกแต่งข้อความขึ้นใหม่ในภาพ annotated

- [ ] **Step 3: เขียนคู่มือ**

```markdown
# คู่มือจัดการโฆษณา

> ตรวจสอบล่าสุด: 22 กรกฎาคม 2026

## คู่มือนี้ใช้สำหรับใคร
## ก่อนเริ่ม
## ภาพรวมการทำงาน
## 1. เปิดรายการโฆษณา
## 2. สร้างโฆษณาใหม่
## 3. เพิ่มรูปโฆษณา
## 4. แก้ไขโฆษณาและรูป
## 5. บันทึกและตรวจผลลัพธ์
## เมื่อใช้งานไม่ได้
## Checklist ก่อนจบงาน
```

ตารางปัญหาต้องมี: ข้อมูลไม่ครบ, จำนวนรูปไม่ถูกต้อง, ไฟล์ไม่รองรับ, upload/delete ไม่สำเร็จ และบันทึกไม่ได้

- [ ] **Step 4: ตรวจขอบเขตการลบ**

คู่มือต้องกล่าวถึงเฉพาะการลบรูปโฆษณาที่ UI รองรับ ห้ามเพิ่มขั้นตอนลบตัวโฆษณาหากระบบไม่มีคำสั่งดังกล่าว

- [ ] **Step 5: Commit คู่มือ Advertisements**

```powershell
git add -- docs/manuals/advertisements
git commit -m "docs: add advertisement user manual"
```

---

### Task 5: ปรับปรุงคู่มือใบเสนอราคาและ Public Link

**Files:**
- Modify: `docs/manuals/quotation/README.md`
- Reuse or replace only when stale: existing image pairs `01-seller-settings`, `02-quotation-list`, `03-quotation-editor`, `04-payment-settings`, `05-certification-settings`
- Create: source and annotated pairs for `06-preview-and-export.png`, `07-share-link.png`, `08-public-desktop.png`, `09-public-mobile.png` under `docs/manuals/quotation/assets/`
- Preserve: `docs/manuals/quotation/exports/quotation-user-manual-th.pdf`
- Read: `app/admin/quotations/page.tsx`
- Read: `app/admin/quotations/new/page.tsx`
- Read: `app/admin/quotations/[id]/page.tsx`
- Read: `app/admin/quotations/settings/company/page.tsx`
- Read: `app/admin/quotations/actions.ts`
- Read: `app/q/[token]/page.tsx`
- Read: `components/admin/quotations/**`

**Interfaces:**
- Consumes: quotation/admin/public states from Task 0 and existing quotation manual/assets
- Produces: คู่มือ Flow เดียวตั้งแต่ตั้งค่าผู้ขายจนลูกค้าเปิด Public Link

- [ ] **Step 1: ตรวจภาพเดิมก่อนถ่ายใหม่**

เปิดภาพ 01-05 เทียบ UI ปัจจุบัน ภาพที่ยังถูกต้องให้ reuse โดยไม่เปลี่ยน binary ภาพที่ชื่อปุ่ม ตำแหน่ง หรือเนื้อหาสำคัญล้าสมัยให้ถ่ายใหม่ทั้ง source และ annotated

- [ ] **Step 2: เดิน Flow ใบเสนอราคาตั้งแต่ต้นจนจบ**

ตรวจ seller/payment/certification settings, list/search/create/edit/save, preview/print/PDF, share, public desktop/mobile และผลของ soft delete ต่อ Public Link ยืนยันว่าข้อมูลภายในไม่แสดงบนหน้า Public

- [ ] **Step 3: เพิ่มภาพ 06-09**

ภาพ `06-preview-and-export` แสดง action สำหรับ preview/print/PDF, `07-share-link` แสดงการเปิดหรือคัดลอก Public Link, `08-public-desktop` และ `09-public-mobile` แสดงเอกสารเดียวกันในสอง viewport โดยปิดบัง token จาก address bar

- [ ] **Step 4: ปรับโครงคู่มือเดิมโดยรักษาข้อมูลที่ยังถูกต้อง**

```markdown
# คู่มือสร้างและจัดการใบเสนอราคา

> ตรวจสอบล่าสุด: 22 กรกฎาคม 2026

## คู่มือนี้ใช้สำหรับใคร
## ก่อนเริ่ม
## ภาพรวมการทำงาน
## 1. ตั้งค่าข้อมูลบริษัทและผู้ขาย
## 2. ตั้งค่าช่องทางชำระเงิน
## 3. ตั้งค่าข้อมูลรับรอง
## 4. สร้างใบเสนอราคา
## 5. บันทึกและแก้ไข
## 6. Preview, Print และดาวน์โหลด PDF
## 7. แชร์ Public Link ให้ลูกค้า
## 8. ค้นหาและลบใบเสนอราคา
## เมื่อใช้งานไม่ได้
## Checklist ก่อนส่งให้ลูกค้า
```

อธิบายให้ชัดว่า action ใดใช้ draft ปัจจุบันและ action ใดต้องบันทึกล่าสุดก่อน ตารางปัญหาต้องมี: สร้างไม่ได้, ยอดรวมผิด, share/download ไม่ได้, มีข้อมูลค้างที่ยังไม่บันทึก และ Public Link เปิดไม่ได้

- [ ] **Step 5: ตรวจ Public Link จากมุมลูกค้า**

เปิดลิงก์โดยไม่ใช้ admin session ตรวจว่าอ่านได้อย่างเดียว ไม่มีหมายเหตุภายใน และ layout ใช้งานได้บน mobile หลัง soft delete ให้ยืนยันพฤติกรรม unavailable ตามระบบจริงโดยไม่เผยสาเหตุภายใน

- [ ] **Step 6: Commit คู่มือ Quotation**

```powershell
git add -- docs/manuals/quotation
git commit -m "docs: complete quotation and public link manual"
```

---

### Task 6: รีวิวรวมและตรวจส่งมอบ

**Files:**
- Review: `docs/manuals/authentication/README.md`
- Review: `docs/manuals/house-management/README.md`
- Review: `docs/manuals/house-images/README.md`
- Review: `docs/manuals/advertisements/README.md`
- Review: `docs/manuals/quotation/README.md`
- Review: all files under each manual's `assets/source/` and `assets/annotated/`

**Interfaces:**
- Consumes: manual bundles from Tasks 1-5
- Produces: คู่มือ 5 Flow ที่รูปแบบสม่ำเสมอ ลิงก์ไม่เสีย และไม่มีข้อมูลลับ

- [ ] **Step 1: ส่ง `webook_reviewer` รีวิวแบบ read-only**

ขอให้ตรวจเทียบ design spec, route/UI ปัจจุบัน, ความครบของ happy path/error path, ชื่อปุ่ม, รูปภาพ, privacy และความสม่ำเสมอ ห้ามแก้ไฟล์

- [ ] **Step 2: แก้เฉพาะข้อพบที่มีหลักฐาน**

Main agent แก้ข้อความหรือภาพเฉพาะกรณีที่ reviewer ชี้ route, component, UI state หรือไฟล์ประกอบที่รองรับข้อพบ หากเป็นความเห็นด้านสำนวนให้เปลี่ยนเฉพาะเมื่อทำให้คำสั่งชัดขึ้น

- [ ] **Step 3: ตรวจว่ามีคู่มือครบ 5 ไฟล์**

Run:

```powershell
Get-ChildItem docs\manuals -Filter README.md -Recurse | Select-Object -ExpandProperty FullName
```

Expected: แสดง `README.md` ของ authentication, house-management, house-images, advertisements และ quotation อย่างละหนึ่งไฟล์

- [ ] **Step 4: ตรวจ Markdown image links**

Run:

```powershell
$manuals = Get-ChildItem docs\manuals -Filter README.md -Recurse
$missing = foreach ($manual in $manuals) {
  $content = Get-Content -Raw -Encoding UTF8 $manual.FullName
  foreach ($match in [regex]::Matches($content, '!\[[^\]]*\]\(([^)]+)\)')) {
    $target = Join-Path $manual.DirectoryName $match.Groups[1].Value
    if (-not (Test-Path -LiteralPath $target)) { $target }
  }
}
if ($missing) { $missing; exit 1 }
'All manual image links exist.'
```

Expected: `All manual image links exist.`

- [ ] **Step 5: ตรวจ whitespace และ project checks**

Run:

```powershell
git diff --check
npm run typecheck
npm run lint
npm run test
```

Expected: ทุกคำสั่ง exit code 0 หาก project check ล้มจาก baseline ที่ไม่เกี่ยวกับเอกสาร ให้บันทึก command และ error โดยไม่แก้โค้ดนอก scope

- [ ] **Step 6: ตรวจด้วยสายตาครั้งสุดท้าย**

เปิด Markdown ทั้ง 5 ไฟล์ใน renderer ตรวจภาษาไทย alt text ลำดับภาพ หมายเลข callout ตาราง troubleshooting และ Checklist เปิดภาพ source/annotated ทุกคู่เพื่อตรวจว่าไม่มีข้อมูลส่วนบุคคล token หรือความลับ

- [ ] **Step 7: Commit ผลแก้จากรีวิว หากมี**

```powershell
git add -- docs/manuals
git commit -m "docs: finalize Webook user manuals"
```

ข้าม commit นี้หาก reviewer ไม่พบสิ่งที่ต้องแก้และ working tree ว่าง
