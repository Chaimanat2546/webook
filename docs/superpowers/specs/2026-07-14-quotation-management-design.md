# Quotation Management Design

## Goal

เพิ่มโมดูลใบเสนอราคาใน Webook Admin สำหรับผู้ดูแลระบบ โดยส่งมอบเป็น 3 MVP ที่ใช้งานได้จริงตามลำดับ:

1. สร้าง ดู แก้ไข ลบ Preview และพิมพ์ใบเสนอราคาหลัก
2. เพิ่มค่าใช้จ่าย ช่องทางชำระเงิน ภาษีหัก ณ ที่จ่าย เงินมัดจำ ลายเซ็น และตราประทับ
3. เพิ่มการแบ่งชำระตามงวด

ระบบนี้ไม่มีสถานะเอกสาร, Workflow อนุมัติ, การตอบรับลูกค้า, Public QR, PDF generator หรือสถานะการชำระเงิน โดยสงวนตำแหน่งเมนูสำหรับ Public Share ในอนาคต แต่ยังไม่รวมการพัฒนาไว้ใน MVP 1-3

## Approved Product Decisions

- ใช้ Webook Admin, Supabase Auth, Supabase PostgreSQL และ Cloudflare Media Worker/R2 ที่มีอยู่
- เพิ่มสิทธิ์ `public.users.allow_tools.allow_quotation`; ห้ามใช้ `allow_accommodation` แทน
- ใช้ Admin Shell ปกติ ไม่ใช้ House Workspace Shell เพราะใบเสนอราคาไม่ใช่ task workspace ของบ้านหนึ่งหลัง
- หน้าสร้างและแก้ไขเป็น Full-width Responsive Editor ไม่จำลองขนาดกระดาษ A4
- ตำแหน่งข้อมูลยังอิงเอกสารจริงเพื่อให้เข้าใจง่าย แต่ใช้ความกว้างหน้าจออย่างเหมาะสม; A4 ใช้เฉพาะ Preview/Print
- ข้อมูลลูกค้าอยู่ซ้ายและข้อมูลเอกสารอยู่ขวากว้างคงที่ประมาณ 384px โดยใช้กริดสองคอลัมน์ตรง ๆ ไม่มีคอลัมน์เว้นว่างตรงกลาง; เรียงซ้อนบนมือถือ
- Header หลักมีชื่อ/เลขเอกสารและปุ่มปิด/บันทึก แถวถัดไปมีข้อมูลบริษัทผู้ขายทางซ้ายและเมนูเอกสารทางขวา
- ไม่มีฟิลด์เรื่องหรือชื่องาน; `reference` อยู่ในกลุ่มข้อมูลเอกสาร
- `branch_number` แสดงและบังคับเฉพาะเมื่อเลือกสำนักงานประเภทสาขา ทั้งผู้ขายและลูกค้า; เมื่อเปลี่ยนเป็นสำนักงานใหญ่ให้ซ่อนและล้างค่า
- VAT กำหนดแยกแต่ละรายการ ส่วน price mode อยู่เหนือรายการสินค้า ไม่อยู่ในกลุ่มข้อมูลเอกสาร
- ยอดรวมแสดงเฉพาะสรุปด้านขวาล่าง ไม่แสดงยอดซ้ำในข้อมูลเอกสาร
- Preview ใช้ draft ปัจจุบันได้ก่อนบันทึก
- Print ทำได้หลังบันทึกครั้งแรกและมีเลขเอกสารแล้ว
- Print ใช้ browser `window.print()` และ print CSS; ไม่เพิ่ม PDF dependency หรือ server-side PDF generator
- ไม่มี autosave; ใช้ปุ่มบันทึกและเตือนเมื่อออกจากหน้าพร้อมข้อมูลที่ยังไม่บันทึก
- ลูกค้ากรอกและเก็บเป็น snapshot แยกต่อใบ ไม่มีข้อมูลลูกค้ากลางใน MVP 1-3
- มีข้อมูลผู้ขายหลักหนึ่งชุด คัดลอกเป็น seller snapshot ตอนสร้างใบ และแก้ seller snapshot เฉพาะใบได้
- ลบใบเสนอราคาแบบ soft delete; เลขเอกสารเดิมห้ามนำกลับมาใช้
- เงินทุกจำนวนคำนวณด้วย scaled integer ไม่ใช้ floating point โดยตรง
- ไม่มีการติดตั้ง dependency ใหม่ตาม design นี้

## Scope By MVP

### MVP 1: Core Quotation

- สิทธิ์และเมนูใบเสนอราคา
- ข้อมูลผู้ขายหลักหนึ่งชุดและโลโก้
- หน้ารายการและค้นหาใบเสนอราคา
- สร้าง ดู แก้ไข และ soft delete
- Full-width Responsive Editor โดยใช้ A4 เฉพาะ Preview/Print
- ข้อมูลผู้ขาย ลูกค้า วันที่ และเลขอ้างอิง
- รายการสินค้า/บริการหลายรายการ
- ส่วนลดต่อรายการและส่วนลดท้ายเอกสาร
- ราคาก่อน VAT หรือรวม VAT โดยเลือกจาก control เหนือตารางรายการ
- VAT หลาย treatment/rate ในเอกสารเดียว
- ยอดรวมและจำนวนเงินเป็นตัวอักษร
- หมายเหตุบนเอกสารและหมายเหตุภายใน
- Preview และ Browser Print

### MVP 2: Payment And Certification

- ค่าใช้จ่ายเพิ่มเติมหลายรายการพร้อม VAT treatment
- ภาษีหัก ณ ที่จ่ายแบบเปอร์เซ็นต์หรือจำนวนเงิน
- เงินมัดจำ/ยอดหักล่วงหน้า
- ยอดต้องชำระ
- ข้อมูลช่องทางชำระเงินหลักและ snapshot ต่อใบ
- ข้อมูลผู้ลงนามหลัก, รูปลายเซ็น และ snapshot ต่อใบ
- ข้อมูลผู้ออกเอกสารและผู้อนุมัติสำหรับแสดงบนเอกสาร
- ตราประทับบริษัท
- ช่องผู้รับเอกสารแบบเว้นว่างสำหรับเซ็นด้วยมือ

### MVP 3: Installments

- เปิด/ปิดการแบ่งชำระตามงวด
- เพิ่ม ลบ และเรียงงวด
- ชื่องวดและรายละเอียด/เงื่อนไข
- เลือกโหมดเปอร์เซ็นต์หรือจำนวนเงินหนึ่งโหมดต่อใบ
- วันครบกำหนดแบบวันที่ตรงหรือจำนวนวันหลังวันที่ออกเอกสาร
- ตรวจยอดรวมทุกงวดให้เท่ากับยอดต้องชำระ
- ไม่มีสถานะของงวด

## Planning Boundary

เอกสารนี้เป็น blueprint ร่วมของทั้ง 3 MVP แต่ implementation ต้องทำและตรวจทีละรอบ ปัจจุบันมี MVP 1 พื้นฐานแล้ว จึงใช้ขอบเขตต่อไปนี้:

- แผน implementation ถัดไปครอบคลุม MVP 1 refinement เท่านั้น: แก้ข้อมูลผู้ขายหลัก, Full-width Editor, ตำแหน่ง field/action, เงื่อนไขเลขสาขา, ตัดชื่องานออกจาก UI, ย้ายเลขอ้างอิง และทำ `unit` ให้เว้นว่างได้
- MVP 2 รวมภาษีหัก ณ ที่จ่ายและ Payment/Certification เริ่มหลัง MVP 1 refinement ผ่าน Definition of Done และต้องมี implementation plan แยก
- MVP 3 เริ่มหลัง MVP 2 ผ่าน Definition of Done และต้องมี implementation plan แยก
- ห้ามสร้างตาราง, UI หรือ abstraction ของ MVP ถัดไปไว้ล่วงหน้าใน MVP ปัจจุบัน

## Architecture

Data flow:

```text
Admin UI
  -> Server Component / Server Action
  -> Quotation service and shared calculator
  -> Repository / storage adapter
  -> Supabase PostgreSQL / Media Worker + R2
```

Rules:

- Client Components ห้ามเข้าถึง Supabase หรือ storage credential โดยตรง
- Server Actions ตรวจ session และ `allow_quotation` ทุกครั้ง
- Service เป็น boundary สำหรับ normalize, validation และการคำนวณยอด
- Client calculator ใช้เพื่อ feedback แบบทันทีเท่านั้น
- Server ใช้ calculator เดียวกันคำนวณใหม่ก่อนบันทึก และไม่เชื่อยอดที่ client ส่งมา
- การบันทึกหัวเอกสาร รายการ ยอดรวม และเลขเอกสารต้องอยู่ใน database transaction เดียว
- Route Handlers ไม่จำเป็นใน MVP 1-3 เพราะยังไม่มี public/external API

Expected route structure:

```text
/admin/quotations
/admin/quotations/new
/admin/quotations/[id]
/admin/quotations/settings/company
```

## Authorization And Database Access

เพิ่ม TypeScript permission helper สำหรับ:

```text
allow_tools.allow_quotation = true
```

Security rules:

- ทุกตารางใหม่ใน `public` เปิด RLS
- ผู้ไม่มี `allow_quotation` อ่านหรือแก้ไขข้อมูลใบเสนอราคาไม่ได้
- เมนูใบเสนอราคาซ่อนสำหรับผู้ไม่มีสิทธิ์
- หน้า admin แสดง unauthorized state และ Server Actions ปฏิเสธซ้ำฝั่ง server
- ไม่ใช้ `user_metadata` สำหรับ authorization
- ไม่ expose service-role key ที่ client

Mutation path:

- Revoke direct quotation-table DML จาก `anon` และ `authenticated`
- Repository เรียก public security-invoker RPC สำหรับ save/delete
- Public RPC delegate ไปยัง security-definer function ใน private, unexposed schema
- Private mutation function ตรวจ `auth.uid()` และ `allow_quotation` ด้วยตัวเองก่อนเขียนข้อมูล
- Security-definer functions ต้องกำหนด safe `search_path`
- Direct authenticated reads ใช้ RLS เป็น defense in depth

เหตุผลที่ใช้ mutation RPC คือการ replace รายการหลายแถวต้อง atomic; ห้ามเกิดกรณีลบรายการเก่าแล้ว insert รายการใหม่ล้มเหลวจนเอกสารเหลือข้อมูลครึ่งชุด

## MVP 1 Data Model

### `public.quotation_company_profiles`

ข้อมูลผู้ขายหลักหนึ่งชุด ตารางใช้ singleton key เช่น `id = 1` และ constraint ไม่ให้มีแถวที่สอง

Fields:

- `id`
- `seller_name`
- `address`
- `tax_id`
- `office_type`: `head_office` หรือ `branch`
- `branch_number`
- `phone`
- `email`
- `website`
- `contact_name`
- `contact_phone`
- `contact_email`
- `logo_url`
- `created_at`
- `updated_at`

Required fields:

- `seller_name`
- `address`
- `tax_id`

`branch_number` ต้องมีค่าเฉพาะเมื่อ `office_type = branch`; เมื่อเลือก `head_office` ให้เก็บเป็น `null`

เมื่อสร้างใบเสนอราคา ระบบคัดลอกข้อมูลทั้งหมดเป็น `seller_snapshot` ผู้ใช้แก้ snapshot เฉพาะใบได้ การแก้ profile ภายหลังห้ามเปลี่ยนใบเก่า

### `public.quotations`

Identity and dates:

- `id uuid primary key`
- `document_number text unique not null`
- `issue_date date not null`
- `valid_until date not null`
- `validity_days integer null`
- `created_at timestamptz`
- `updated_at timestamptz`
- `deleted_at timestamptz null`

Snapshots:

- `seller_snapshot jsonb not null`
- `customer_snapshot jsonb not null`

Document fields:

- `reference text null`
- `currency text not null default 'THB'`
- `price_mode text`: `vat_exclusive` หรือ `vat_inclusive`
- `public_notes text null`
- `internal_notes text null`

ฐานข้อมูลปัจจุบันมี legacy column `subject` อยู่แล้ว แต่ requirement ใหม่ไม่มีชื่องาน จึงไม่แสดงใน Editor/Preview/Print และไม่รับเป็น active form field การ refinement รอบนี้ไม่ drop column หรือแก้ migration เดิม; การลบ physical column ต้องเป็น migration แยกเมื่อมีเหตุผลและได้รับอนุมัติ

Document discount:

- `document_discount_type text null`: `percent` หรือ `amount`
- `document_discount_value numeric(14,4) not null default 0`

Server-computed totals:

- `subtotal numeric(14,2)`
- `item_discount_total numeric(14,2)`
- `document_discount_total numeric(14,2)`
- `taxable_total numeric(14,2)`
- `vat_total numeric(14,2)`
- `grand_total numeric(14,2)`

MVP 1 รองรับ `THB` เท่านั้น `currency` ถูกเก็บเพื่อให้ snapshot ชัดเจน ไม่ได้หมายความว่ารองรับอัตราแลกเปลี่ยน

จำนวนเงินเป็นตัวอักษรเป็น derived display value จาก calculator และไม่เก็บซ้ำในฐานข้อมูล

Seller snapshot shape:

```text
name
address
taxId
officeType
branchNumber
phone
email
website
contactName
contactPhone
contactEmail
logoUrl
```

Customer snapshot shape:

```text
name
address
taxId
officeType
branchNumber
contactName
phone
email
shippingAddress
serviceLocation
```

`shippingAddress` และ `serviceLocation` คงอยู่เฉพาะเพื่อรองรับข้อมูลเดิมใน storage แต่ MVP ไม่รับค่าจาก Editor และไม่แสดงใน Preview/Print

Required customer fields:

- `name`
- `address`

ฟิลด์ลูกค้าอื่นไม่บังคับและซ่อนจาก Preview/Print เมื่อไม่มีค่า

Customer snapshot ไม่มีฟิลด์เรื่องหรือชื่องาน และใช้กติกา `branchNumber` แบบเดียวกับผู้ขาย: บังคับเฉพาะสาขาและเป็น `null` สำหรับสำนักงานใหญ่

### `public.quotation_items`

- `id uuid primary key`
- `quotation_id uuid not null references quotations(id) on delete cascade`
- `position integer not null`
- `sku text null`
- `name text not null`
- `description text null`
- `quantity numeric(12,3) not null`
- `unit text null`
- `unit_price numeric(14,2) not null`
- `discount_type text null`: `percent` หรือ `amount`
- `discount_value numeric(14,4) not null default 0`
- `vat_treatment text`: `taxable`, `exempt` หรือ `none`
- `vat_rate numeric(5,2) not null default 7.00`
- `gross_amount numeric(14,2)`
- `discount_amount numeric(14,2)`
- `document_discount_allocation numeric(14,2)`
- `taxable_amount numeric(14,2)`
- `vat_amount numeric(14,2)`
- `line_total numeric(14,2)`

`sku` คงอยู่ใน schema เพื่อ compatibility เท่านั้น และไม่แสดงใน Editor เพราะรายการเป็นบริการบ้านพัก ไม่ใช่สินค้าคงคลัง

Constraints:

- `quantity > 0`
- `unit_price >= 0`
- percent discount อยู่ระหว่าง `0` และ `100`
- amount discount ไม่เกิน gross amount
- VAT rate อยู่ระหว่าง `0` และ `100`
- unique `(quotation_id, position)`
- ใบเสนอราคาต้องมีอย่างน้อยหนึ่งรายการ; service และ transactional save function enforce กติกานี้

`quantity` เป็นข้อมูลบังคับและห้ามว่าง ส่วน `unit` ไม่บังคับ; เมื่อไม่มีหน่วยให้เว้นว่างทั้ง Editor และ Preview/Print โดยไม่กระทบสูตรคำนวณ

เนื่องจาก schema ปัจจุบันกำหนด `unit not null`, refinement ต้องสร้าง migration ใหม่เพื่อ drop เฉพาะ `NOT NULL` constraint ห้ามแก้ migration เดิม

VAT meaning:

- VAT 7%: `vat_treatment = taxable`, `vat_rate = 7`
- VAT 0%: `vat_treatment = taxable`, `vat_rate = 0`
- ยกเว้น VAT: `vat_treatment = exempt`, `vat_rate = 0`
- ไม่คิด VAT: `vat_treatment = none`, `vat_rate = 0`

`exempt` และ `none` ให้ยอด VAT เท่ากับศูนย์ แต่คงค่าคนละแบบเพื่อแสดงข้อความบนเอกสารได้ถูกต้อง

## Document Numbering

รูปแบบ MVP 1:

```text
QO-YYYYMMDD-####
QO-20260714-0001
```

Rules:

- ออกเลขเมื่อบันทึกใบใหม่สำเร็จครั้งแรก
- running number แยกตาม `issue_date` และเริ่มใหม่รายวัน
- ใช้ counter table ใน private schema และ row lock/atomic update
- client ห้ามกำหนดเลขเอง
- unique constraint เป็นชั้นป้องกันสุดท้าย
- การบันทึกล้มเหลวต้อง rollback counter ใน transaction เดียวกัน
- แก้ `issue_date` ภายหลังไม่เปลี่ยนเลขเอกสาร
- soft delete ไม่คืนเลขเดิม
- เมื่อ running เกิน 9999 ให้แสดงเลขมากกว่า 4 หลัก ห้าม truncate หรือ reuse

## Date Rules

- `issue_date` เริ่มต้นเป็นวันที่ปัจจุบันใน timezone `Asia/Bangkok`
- ผู้ใช้เลือกย้อนหลังหรือล่วงหน้าได้
- ผู้ใช้เลือก validity ได้สองโหมด:
  - เลือก `valid_until` โดยตรง: `validity_days = null`
  - ระบุจำนวนวัน: เก็บ `validity_days` และคำนวณ `valid_until = issue_date + validity_days`
- เมื่อเปลี่ยน `issue_date` ในโหมดจำนวนวัน ให้คำนวณ `valid_until` ใหม่
- `valid_until >= issue_date`
- `validity_days >= 0`

## Money Representation And Rounding

PostgreSQL เก็บเงินด้วย `numeric` แต่ calculator ใน TypeScript ห้ามคำนวณเงินด้วย binary floating point โดยตรง

Internal calculator representation:

- จำนวนเงิน: integer สตางค์
- quantity: integer scale 1000
- percent: integer basis points โดย 100.00% = 10000
- ทำ rounding half-up เมื่อผลลัพธ์ต้องกลับเป็นสตางค์

Calculator ใช้ native `BigInt` ภายในสำหรับ amount, quantity scale และ basis points โดยไม่เพิ่ม dependency รับค่าเป็น normalized decimal strings และคืนค่าที่ boundary เป็น decimal strings/numeric-ready values ห้าม serialize `BigInt` เข้า React props, JSON หรือ Server Action result โดยตรง

## Calculation Rules

### Per-item gross and item discount

```text
gross = quantity × unit_price

percent discount = gross × discount_percent
amount discount = entered amount

after_item_discount = gross − item_discount
```

Discount must not make the item negative.

### Document discount

- คำนวณจากผลรวม `after_item_discount` ของรายการเท่านั้น
- ค่าใช้จ่ายเพิ่มเติมของ MVP 2 ไม่เข้าฐานส่วนลดท้ายเอกสาร
- percent หรือ amount discount ต้องไม่เกินฐานส่วนลด
- กระจาย discount ไปยังรายการตามสัดส่วนมูลค่ารายการ
- ใช้ largest-remainder allocation ในหน่วยสตางค์เพื่อให้ผลรวม allocation เท่ากับ document discount ทุกครั้ง

### VAT-exclusive price mode

```text
taxable_amount = after_item_discount − allocated_document_discount
vat_amount = taxable_amount × vat_rate
line_total = taxable_amount + vat_amount
```

สำหรับ `exempt` และ `none`, `vat_amount = 0`.

### VAT-inclusive price mode

```text
inclusive_amount = after_item_discount − allocated_document_discount
taxable_amount = inclusive_amount ÷ (1 + vat_rate)
vat_amount = inclusive_amount − taxable_amount
line_total = inclusive_amount
```

สำหรับ `exempt`, `none` หรือ taxable 0%, `vat_amount = 0` และ `taxable_amount = inclusive_amount`.

### Document totals

- ปัดผลระดับรายการเป็น 2 ตำแหน่งก่อนรวม
- ยอดท้ายเอกสารเป็นผลรวม line totals ที่ปัดแล้ว
- VAT summary แยกตาม treatment/rate ใน Preview/Print
- จำนวนเงินเป็นตัวอักษรใน MVP 1 แปลงจาก `grand_total`
- ตัวแปลงจำนวนเงินภาษาไทยเป็น shared pure utility และมี regression tests

## Atomic Save

Create:

1. ตรวจ session และ `allow_quotation`
2. Normalize และ validate snapshots, dates, items และ notes
3. คำนวณ line totals และ document totals ใหม่ฝั่ง server
4. เริ่ม database transaction
5. ออก `document_number`
6. Insert quotation
7. Insert all quotation items
8. Commit และคืน `id` กับ `document_number`

Update:

1. ตรวจสิทธิ์และโหลด quotation ที่ยังไม่ถูกลบ
2. Normalize, validate และคำนวณใหม่
3. เริ่ม database transaction
4. Update quotation โดยไม่เปลี่ยน document number
5. Replace quotation items ภายใน transaction เดียว
6. Commit

Delete:

1. Dialog แสดง document number และ customer name
2. ตรวจสิทธิ์ซ้ำใน Server Action/private mutation function
3. ตั้ง `deleted_at`
4. รายการปกติและ route edit ต้องมองไม่เห็นเอกสารนี้

หาก save ล้มเหลว UI ต้องเก็บ draft เดิมไว้และอนุญาตให้ retry

## Admin UI

### Sidebar

- เพิ่มเมนู `ใบเสนอราคา`
- ใช้ icon ที่มีใน `lucide-react`
- active เมื่อ pathname เริ่มด้วย `/admin/quotations`
- แสดงเฉพาะ user ที่มี `allow_quotation`

เนื่องจาก sidebar ปัจจุบันเป็น Client Component แต่สิทธิ์ตรวจ server-side ต้องถูกต้อง โครงสร้าง implementation ต้องส่ง permission ที่ผ่าน server มาเป็น prop หรือใช้ server-owned navigation data ห้ามตัดสิน authorization จาก client-only state

### `/admin/quotations`

- Page header: `ใบเสนอราคา`
- Actions:
  - `ข้อมูลผู้ขาย`
  - `สร้างใบเสนอราคา`
- Search by document number or customer name
- List/table columns:
  - document number
  - customer name
  - issue date
  - valid until
  - grand total/amount due ตาม MVP
  - updated time
  - actions
- Actions: edit, print, delete
- ไม่มี status column หรือ status filter
- Sort by `updated_at desc`
- Query เฉพาะ `deleted_at is null`
- Page size เริ่มต้น 20 รายการ
- Repository push search/pagination ไปที่ database; อย่าโหลดเอกสารทั้งหมดมา filter ใน client

### `/admin/quotations/settings/company`

- แก้ข้อมูลผู้ขายหลักหนึ่งชุด
- Upload/replace logo
- แสดง Preview โลโก้ปัจจุบัน
- Save ชัดเจน ไม่มี autosave
- การเปลี่ยน profile ไม่มีผลกับ quotation snapshots เดิม

### `/admin/quotations/new` And `/admin/quotations/[id]`

Header toolbar:

- Header หลัก: title `สร้างใบเสนอราคา`/`แก้ไขใบเสนอราคา`, document number เมื่อมีแล้ว, `ปิดหน้าต่าง` และ split button `บันทึกเอกสาร`
- แถวข้อมูลผู้ขาย: โลโก้ ชื่อบริษัท ประเภทสำนักงาน เลขผู้เสียภาษี และ action `แก้ไขเฉพาะใบ` ทางซ้าย
- เมนูเอกสารอยู่ทางขวาของแถวข้อมูลผู้ขาย: `ดูตัวอย่าง`, `แชร์`, `พิมพ์`, `ดาวน์โหลด`, `เพิ่มเติม`
- `ดูตัวอย่าง` ใช้ draft ปัจจุบันได้; `แชร์`, `พิมพ์` และ `ดาวน์โหลด` ใช้ได้เฉพาะใบที่บันทึกแล้วตามขอบเขตของแต่ละ MVP
- `แชร์` และ `ดาวน์โหลด` เป็นตำแหน่งสำหรับ capability อนาคตใน MVP 1-3; ห้ามผูก action ปลอมหรือสร้าง Public API ล่วงหน้า
- Delete อยู่ใน `เพิ่มเติม` เฉพาะ edit page และต้องยืนยันก่อนลบ
- unsaved-changes indicator เป็น UI state ไม่ใช่ business status

Full-width editor behavior:

- ไม่สร้างกรอบหรือพื้นที่ว่างตามสัดส่วน A4 ในหน้าสร้าง/แก้ไข
- ใช้ตำแหน่งข้อมูลคล้ายเอกสารจริง: ลูกค้าซ้าย ข้อมูลเอกสารขวา รายการอยู่เต็มความกว้าง และยอดสรุปอยู่ขวาล่าง
- กลุ่มข้อมูลลูกค้าและข้อมูลเอกสารไม่ยืดเต็มจอเกินความยาวข้อมูลที่คาดไว้
- ช่องข้อมูลสั้น เช่น วันที่ จำนวนวัน ประเภทสำนักงาน เลขผู้เสียภาษี และโทรศัพท์ ใช้ความกว้างตามข้อมูล ส่วนชื่อและที่อยู่ยังใช้พื้นที่กว้างได้
- Dropdown ใช้ความสูง ขอบ และ focus geometry เดียวกับ input และปุ่มเรียงรายการอยู่ข้างช่องรายการโดยไม่ดันแนว input ลง
- ไม่แสดงที่อยู่จัดส่ง สถานที่บริการ หรือ SKU ใน Editor และ Preview/Print
- ข้อมูลเอกสารประกอบด้วยวันที่ออก, วิธี/จำนวนวันใช้ได้, วันที่ใช้ได้ถึง, สกุลเงิน และเลขอ้างอิงที่ไม่บังคับ
- ไม่มีช่อง `เรื่อง / ชื่องาน`
- เลขสาขาแสดงเฉพาะเมื่อ office type เป็น `สาขา`; เลือก `สำนักงานใหญ่` แล้วต้องซ่อนและล้างค่า
- VAT treatment/rate อยู่ต่อรายการสินค้า และ price mode (`ราคายังไม่รวม VAT`/`ราคารวม VAT แล้ว`) อยู่เหนือรายการ
- `quantity` ต้องกรอกและมากกว่า 0; `unit` เป็นช่องไม่บังคับ
- ยอดรวมไม่แสดงในกลุ่มข้อมูลเอกสาร เพราะมีสรุปที่ด้านขวาล่างแล้ว
- Field ปกติมีหน้าตาใกล้ตำแหน่งบนเอกสารจริง
- แสดง outline/background ที่ชัดขึ้นเมื่อ hover, focus, invalid หรือ editable area ต้องค้นพบได้
- required fields มี label/indicator ที่เข้าถึงได้ ไม่พึ่งสีอย่างเดียว
- computed totals เป็น read-only
- เพิ่มรายการจากปุ่มใต้ตาราง
- ลบรายการจาก row action พร้อมป้องกันการลบรายการสุดท้าย
- ไม่เพิ่ม drag-and-drop dependency; MVP ใช้ insertion order และปุ่มเลื่อนขึ้น/ลงหากต้องแก้ลำดับ
- validation message แสดงใกล้ field และ focus/scroll ไป error แรกเมื่อ save ไม่ผ่าน

Mobile behavior:

- ใช้ form responsive ปกติ ไม่ย่อกระดาษ A4 และไม่ต้องเปิด bottom sheet สำหรับ field ทั่วไป
- ข้อมูลลูกค้าและข้อมูลเอกสารเรียงซ้อนกัน
- ตารางรายการเปลี่ยนเป็น editable cards บนมือถือเพื่อไม่บีบ input จนใช้งานไม่ได้
- เมนูเอกสารรวมไว้ใต้ `เพิ่มเติม` โดยคงปุ่มบันทึกใน Header
- ปุ่มมี touch target ที่เหมาะสม
- ยอดรวมและ action bar ต้องเข้าถึงได้โดยไม่บัง field ที่กำลังกรอก

Preview and Print:

- Preview render plain text จาก draft ปัจจุบันและซ่อน editing controls
- ก่อนบันทึกแสดง `เลขที่ออกเมื่อบันทึก` แทน document number
- Print disabled จนบันทึกครั้งแรก
- Print ใช้ข้อมูลที่บันทึกแล้วและ `window.print()`
- Print CSS ซ่อน Admin Shell, toolbar, validation, add/delete controls และ field outlines
- รองรับเนื้อหาหลายหน้าโดยไม่ตัด row หรือ signature block กลางส่วนเมื่อ CSS หลีกเลี่ยงได้
- Print output ใช้ขนาด A4 และตรวจด้วย browser print preview

### Future Public Share Contract (Not In MVP 1-3)

- แชร์ได้เฉพาะใบที่บันทึกและมี document number แล้ว
- หน้า Public เป็น read-only และไม่ต้องเข้าสู่ระบบ
- ใช้ random unguessable token; ห้ามใช้ document number เป็น public URL
- แสดงเฉพาะข้อมูลล่าสุดที่บันทึกแล้ว ไม่แสดง draft ที่ยังไม่ได้บันทึก
- ผู้ดู Public พิมพ์และดาวน์โหลดได้ แต่แก้ไข ตอบรับ ปฏิเสธ เปลี่ยนสถานะ หรือลงนามออนไลน์ไม่ได้
- Admin ต้อง revoke หรือ rotate token ได้ และ soft delete ต้องทำให้ลิงก์เปิดไม่ได้ทันที
- Public route, token schema, rate limiting และ security tests ต้องออกแบบใน implementation plan ของ feature นี้ภายหลัง ห้าม scaffold ใน MVP ปัจจุบัน

## Logo And Asset Storage

MVP 1 ใช้ Media Worker/R2 ที่มีอยู่และเพิ่ม trusted prefix:

```text
quotations/assets/
```

Rules:

- Upload ผ่าน server-side storage adapter เท่านั้น
- Client ห้ามส่ง arbitrary object path
- Server สร้าง versioned random filename
- Worker ยอมรับ prefix ใหม่เฉพาะ method และ authorization pattern เดิม
- Validate MIME type, extension และ file size ฝั่ง server
- รับ input PNG, JPEG และ WebP ขนาดไม่เกิน 10 MB
- Normalize เป็น WebP, จำกัดด้านยาวไม่เกิน 1600 px และ preserve alpha channel สำหรับโลโก้/ลายเซ็น/ตราประทับ
- Resize ด้วย browser canvas ที่มีอยู่ก่อน upload; server ยังคงตรวจ MIME type, file size และ trusted object key ซ้ำ
- เก็บ full trusted Worker URL หรือ trusted object reference ตาม pattern ที่ implementation เลือกเพียงแบบเดียว
- ไม่รับ arbitrary external image URL สำหรับ quotation assets
- ห้ามสร้าง arbitrary image proxy

Snapshot retention:

- เมื่อเปลี่ยนโลโก้ ให้อัปโหลด object ใหม่และอัปเดต company profile หลัง upload สำเร็จ
- Quotation seller snapshot เก็บ asset version ที่ใช้ตอนสร้าง/แก้ใบ
- ห้ามลบโลโก้เก่าทันที เพราะ quotation เก่าอาจยังอ้างอิง
- หาก DB update ล้มเหลวหลัง upload ให้ cleanup object ใหม่แบบ best effort
- Automatic orphan cleanup ไม่อยู่ใน MVP 1

Ponytail ceiling: เก็บ versioned asset เก่าที่อาจมี quotation อ้างอิงไว้ก่อน เพิ่ม reference-aware cleanup เมื่อ storage usage วัดได้ว่าเป็นปัญหา

## MVP 2 Data Extensions

### Company-level reusable data

เพิ่มข้อมูลหลักที่ใช้ซ้ำ:

- `public.quotation_company_payment_methods`
- `public.quotation_company_signers`
- company stamp asset ใน quotation company profile

Payment method master supports:

- type: bank transfer, PromptPay, QR payment, cash หรือ other
- bank logo
- bank name
- branch name
- account type
- account number stored as text
- account name
- PromptPay identifier
- payment QR asset
- instructions
- display order
- active flag

Signer master supports:

- name
- position/title
- signature asset
- display order
- active flag

Master data ถูก copy เป็น quotation snapshot และแก้เฉพาะใบได้ ข้อมูลใบเก่าห้ามเปลี่ยนตาม master

### `public.quotation_additional_charges`

- `id`
- `quotation_id`
- `position`
- `label`
- `amount`
- `vat_treatment`
- `vat_rate`
- `taxable_amount`
- `vat_amount`
- `line_total`

ค่าใช้จ่ายเพิ่มเติมไม่อยู่ในฐานส่วนลดท้ายเอกสารและถูกเพิ่มหลัง document discount

### `public.quotation_payment_methods`

เก็บ snapshot ของ payment methods ที่เลือกต่อใบ พร้อม `position` ข้อมูลต้องไม่เปลี่ยนเมื่อ master ถูกแก้

### Quotation fields added in MVP 2

- `withholding_tax_type`: null, `percent`, `amount`
- `withholding_tax_value`
- `withholding_tax_base`
- `withholding_tax_amount`
- `deposit_amount`
- `amount_due`
- `issuer_snapshot`
- `approver_snapshot`
- `stamp_url`

Certification rules:

- Issuer และ approver เป็นข้อมูลแสดงบนเอกสาร ไม่ใช่ workflow
- Snapshot มีชื่อ ตำแหน่ง signature URL และวันที่ที่แสดง
- ช่องผู้รับเอกสารเป็นพื้นที่ว่างใน Preview/Print ไม่เก็บการตอบรับออนไลน์
- ไม่มี approve/reject action และไม่มี approval history

Withholding tax UI and validation:

- ด้านขวาล่างมี checkbox `หัก ณ ที่จ่าย`; ค่าเริ่มต้นเป็นปิด
- เมื่อติ๊กเปิด ให้แสดง numeric input สำหรับเปอร์เซ็นต์ ค่าเริ่มต้น `3.00` แต่ผู้ใช้แก้ได้
- รับค่า `0-100` และทศนิยมไม่เกิน 2 ตำแหน่ง
- ยอดหักคำนวณและแสดงทันที พร้อมคำนวณ `amount_due` ใหม่
- ปุ่มแก้ไขข้างยอดรองรับการปรับฐานคำนวณสำหรับเอกสารที่มีสินค้าและบริการผสมกัน หรือเปลี่ยนเป็นจำนวนเงินคงที่
- ค่า percentage ใช้ `withholding_tax_base`; ค่าเริ่มต้นของฐานคือ pre-VAT total หลังส่วนลด และผู้ใช้ override ได้ไม่เกิน pre-VAT total
- เมื่อเอา checkbox ออก ให้ type/base/value/amount กลับเป็น `null`/ศูนย์ตาม payload contract และไม่หักจากยอดชำระ

MVP 2 calculation order:

```text
discounted item bases
− document discount allocated to items
+ additional charge bases
= pre-VAT total

VAT = item VAT + additional charge VAT
grand total = pre-VAT total + VAT

withholding tax:
  percent -> withholding tax base × rate
  amount  -> entered fixed amount

amount due = grand total − withholding tax − deposit
```

Rules:

- withholding tax, deposit และ amount due ห้ามติดลบ
- withholding tax + deposit ห้ามเกิน grand total
- จำนวนเงินเป็นตัวอักษรใน MVP 2-3 ใช้ `amount_due`
- หาก percentage withholding tax ไม่ตรงกับกรณีภาษีจริง ผู้ใช้เลือก fixed amount ได้; MVP นี้ไม่สร้าง per-item withholding categories

## MVP 3 Data Extensions

### Quotation installment mode

เพิ่มค่า nullable ที่ parent quotation:

- `installment_mode`: `percent` หรือ `amount`; null หมายถึงไม่แบ่งงวด

ใบหนึ่งใช้โหมดเดียวกันทุกงวด ห้ามผสม percent และ amount เพื่อให้ validation และการแสดงผลชัดเจน

### `public.quotation_installments`

- `id`
- `quotation_id`
- `position`
- `title`
- `terms`
- `percent_value null`
- `amount numeric(14,2)`
- `due_mode`: `date` หรือ `days_after_issue`
- `due_date`
- `days_after_issue null`

Percent mode:

- percent รวมต้องเท่ากับ `100.00`
- system คำนวณ amount จาก `amount_due`
- งวดสุดท้ายรับ rounding remainder เพื่อให้ยอดรวมตรง `amount_due`

Amount mode:

- ผู้ใช้กรอก amount ทุกงวด
- amount รวมต้องเท่ากับ `amount_due`

Due-date rules:

- `date`: ผู้ใช้กรอก `due_date` โดยตรง
- `days_after_issue`: เก็บจำนวนวันและคำนวณ `due_date`
- เปลี่ยน `issue_date` ต้องคำนวณ due date ของ rows แบบ `days_after_issue` ใหม่
- เปลี่ยนรายการ ส่วนลด ภาษี ค่าใช้จ่าย WHT หรือ deposit จน `amount_due` เปลี่ยน ต้อง validate schedule ใหม่และ block save จนยอดงวดตรง

ไม่มี installment status, paid amount, receipt หรือ overdue automation

## Error Handling

| Case | System behavior | User-facing behavior |
|---|---|---|
| Invalid input | ไม่เรียก database mutation | แสดง error ใกล้ field และ focus จุดแรก |
| Server/database save fails | Rollback transaction | Draft ยังอยู่, แสดง Alert และ retry ได้ |
| Document number conflict | Transaction retry/unique failure handling | ไม่แสดงเอกสารที่บันทึกครึ่งชุด |
| Asset upload succeeds but DB update fails | Best-effort delete new object | Profile เดิมยังอยู่และแจ้ง upload ใหม่ |
| Asset fails to load | ไม่ proxy URL อื่น | แสดง placeholder และ retry/replace action |
| Unauthorized | ปฏิเสธ page และ mutation | Unauthorized state; hide menu/action |
| Deleted/not found | Query excludes deleted row | Not-found state พร้อมกลับหน้ารายการ |

ข้อความผิดพลาดห้ามเผย secret, access token, authorization header, service-role key, storage secret หรือ raw database detail ที่ไม่จำเป็น

## Accessibility And Responsive Verification

- ทุก field มี accessible label แม้ visual label จะย่อบนเอกสาร
- Keyboard navigation ต้องเข้าถึง field และ row actions ตามลำดับเอกสาร
- Focus state ชัดเจนและไม่ใช้สีอย่างเดียว
- Error summary เชื่อมไป field ที่ผิด
- Dialog/Sheet ต้องจัดการ focus และ Escape ตาม shadcn primitives
- Touch targets เหมาะกับ mobile
- ตรวจ mobile, tablet, laptop และ desktop
- ตรวจ browser print preview สำหรับ A4 หนึ่งหน้าและหลายหน้า

## Testing

ใช้ test runner และ dependency ที่มีอยู่ใน repo ห้ามเพิ่ม test dependency โดยไม่จำเป็น

### MVP 1 automated tests

- permission helper for `allow_quotation`
- migration structure, constraints and RLS rules
- unauthorized reads/mutations fail in local Supabase verification
- document number resets per issue date, remains unique under concurrency and does not change on edit
- date-mode and validity-days behavior
- exclusive and inclusive VAT
- VAT 7%, VAT 0%, exempt and none
- percent and amount item discounts
- percent and amount document discounts
- mixed VAT rates and largest-remainder discount allocation
- fixed rounding regression cases
- Thai baht text conversion
- at least one item and all validation limits
- create/update atomic save behavior
- soft delete hides quotation and preserves document number
- seller snapshot remains unchanged when company profile changes
- logo storage path/MIME/size validation
- page source/behavior tests for list, full-width responsive editor, conditional branch number, required quantity, optional unit, Preview และ Print controls where practical

### MVP 2 automated tests

- additional charge VAT and totals
- withholding tax checkbox, editable percentage, default/overridden base and fixed amount
- deposit and amount due validation
- payment method snapshot independence
- signer/stamp snapshot independence
- signature/stamp asset validation

### MVP 3 automated tests

- percent total must equal 100.00
- amount total must equal amount due
- last installment receives rounding remainder
- direct due date
- days-after-issue due date recalculation
- amount-due changes invalidate mismatched schedules

### Verification commands

```text
npm run typecheck
npm run lint
npm run test
npm run build
```

Supabase changes must also be applied and verified locally before staging. Never test new SQL on production first.

## Documentation Updates During Implementation

MVP 1 implementation must update:

- `README.md`: current focus, routes, permission and usage summary
- `docs/architecture.md`: quotation data flow, RLS and asset storage boundary
- new `docs/quotation-management.md`: behavior, calculation rules, validation, edge cases and testing checklist
- `.env.example` only if implementation adds or renames variables; the approved design reuses existing Media Worker variables

MVP 2 and MVP 3 update the same feature document with their actual behavior. `docs/api.md` does not need quotation endpoints because no public API exists in MVP 1-3.

## Non-goals

- Business status such as draft, sent, accepted, rejected, expired or cancelled
- Approval workflow or approval history
- Customer acceptance/rejection/request changes
- Public quotation page or public QR/token (สงวน action และ contract ไว้สำหรับ feature อนาคต แต่ไม่ implement ใน MVP 1-3)
- PDF download or server-side PDF generation
- Email sending
- Revision/version workflow
- View history or full audit log
- Payment collection or payment status
- Installment payment status
- ข้อมูลลูกค้า
- Product/SKU Master
- Multiple currencies or exchange rates
- Multiple seller companies or branches as separate profiles
- Reusable quotation templates
- Automatic orphan-asset cleanup
- Public/external quotation API

## Definition Of Done Per MVP

An MVP is complete only when:

- approved scope for that MVP is implemented
- migration, RLS, generated types/payload types and tests agree
- money is recalculated server-side before save
- no partial save can occur
- mobile/tablet/laptop/desktop behavior is verified
- Preview/Print output is verified
- error and unauthorized states are handled
- required documentation is updated
- typecheck, lint, tests and build pass, or skipped checks are reported with a reason
