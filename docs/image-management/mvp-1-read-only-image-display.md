# MVP 1: Read-only Image Display

## Goal

ดึงข้อมูลบ้านพักและรูปภาพจากฐานข้อมูลมาแสดงให้ถูกต้องก่อน

MVP นี้ยังไม่เพิ่มรูป ลบรูป เรียงรูป ตั้ง cover หรือบันทึกข้อมูลใด ๆ

## In Scope

- ตรวจสอบว่า user login แล้ว
- จำกัดการเข้าใช้งานเฉพาะ Administrator และ Operator
- แสดงรายการบ้านพักทั้งหมดจาก `listings`
- เรียงบ้านที่ `is_active = true` ก่อน `is_active = false`
- เข้าไปดูรูปของบ้านพักแต่ละหลังได้
- ดึงรูปจาก `images` ตาม `property_id`
- แสดงรูปโดยใช้ `image_name` เป็นค่าหลัก
- แสดงข้อมูล `image_zone`
- แสดงข้อมูล `image_move`
- เรียงรูปตาม `image_move`
- แสดง loading state
- แสดง empty state
- แสดง error state
- อ่านค่า `image_zone` ที่มีอยู่จาก database เพื่อทำความเข้าใจข้อมูลจริง

## Out of Scope

- เพิ่มรูป
- ลบรูป
- ลบไฟล์จริง
- เรียงรูป
- เปลี่ยน `image_zone`
- ตั้ง cover
- บันทึกข้อมูล
- upload image
- import image
- external provider CRUD
- สร้าง server-side allowed image provider config ใหม่
- สร้าง env ใหม่ เช่น `IMAGE_BASE_URL` หรือ `ALLOWED_IMAGE_HOSTS`

## Screen: `/admin/houses`

ใช้สำหรับแสดงรายการบ้านพักที่สามารถจัดการรูปได้

ข้อมูลที่แสดง:

- `id`
- `property_id`
- `title`
- `bedrooms`
- `bathrooms`
- `location_zone`
- `is_active`
- ปุ่ม "จัดการรูป"

Rules:

- แสดงบ้านพักทั้งหมด ทั้ง `is_active = true` และ `is_active = false`
- เรียง `is_active = true` ก่อน `is_active = false`
- หน้านี้ยังไม่ใช่หน้าจัดการข้อมูลบ้านพักเต็มรูปแบบ
- หน้านี้ทำหน้าที่เป็นทางเข้าไปยังหน้ารูปภาพเท่านั้น

## Screen: `/admin/houses/[houseId]/images`

ใช้สำหรับแสดงรูปของบ้านพัก 1 หลัง

ข้อมูลที่แสดง:

- ชื่อบ้านพัก
- `property_id`
- รายการรูปทั้งหมด
- preview รูป
- `image_name`
- `image_zone`
- `image_move`
- `created_at`
- `updated_at`

Rules:

- ดึงรูปจาก `images` ด้วย `property_id`
- เรียงรูปตาม `image_move` จากน้อยไปมาก
- `image_move` เป็นเลขลำดับ 1, 2, 3, 4, ...
- ยังไม่อนุญาตให้แก้ไขข้อมูล
- ยังไม่อนุญาตให้ลบรูป
- ยังไม่อนุญาตให้ reorder
- ยังไม่อนุญาตให้เปลี่ยน zone
- ยังไม่อนุญาตให้ตั้ง cover

## Data Source

Database: Supabase Database

### `listings`

ใช้ fields:

- `id`
- `property_id`
- `title`
- `bedrooms`
- `bathrooms`
- `location_zone`
- `is_active`

### `images`

ใช้ fields:

- `id`
- `property_id`
- `image_name`
- `image_url`
- `create_by`
- `image_zone`
- `image_move`
- `created_at`
- `updated_at`

## Image URL Behavior

`image_name` คือค่าหลักที่ใช้ทำงานกับรูป

`image_url` ยังไม่ควรถูกถือว่าเป็น URL จริงหรือ source of truth

ใน MVP 1 ให้ระบบอ่าน code ปัจจุบันก่อนว่าโปรเจกต์สร้าง URL รูปจาก `image_name` อย่างไร

Known display host ที่อาจต้องใช้ใน Next.js `images.remotePatterns`:

```txt
d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws
```

Rules:

- ใช้ pattern ที่มีอยู่ในโปรเจกต์ก่อน
- อย่าสร้าง image provider config ใหม่เอง
- อย่าสร้าง env ใหม่เอง
- อย่าสร้าง open image proxy
- ห้าม expose Bearer token หรือ credential ไป client

## States

Loading:

- กำลังโหลดรายการบ้าน
- กำลังโหลดรูปของบ้าน

Empty:

- กรณีไม่มีรูป แสดงข้อความ "บ้านนี้ยังไม่มีรูป"

Error:

- โหลดรายการบ้านไม่สำเร็จ
- โหลดรูปไม่สำเร็จ
- ไม่มีสิทธิ์เข้าใช้งาน
- ไม่พบข้อมูลบ้าน
- รูปแสดงไม่ได้

## Testing Checklist

- ต้อง login ก่อนเข้าหน้า image management
- Administrator เข้าใช้งานได้
- Operator เข้าใช้งานได้
- user ที่ไม่มีสิทธิ์เข้าไม่ได้
- แสดงบ้านพักทั้งหมดจาก `listings`
- บ้านที่ `is_active = true` แสดงก่อน `is_active = false`
- กดเข้าไปดูรูปของบ้านได้
- โหลดรูปตาม `property_id` ได้
- รูปเรียงตาม `image_move`
- แสดง `image_zone` ได้
- แสดง empty state เมื่อบ้านไม่มีรูป
- แสดง error state เมื่อโหลดข้อมูลล้มเหลว
- ไม่มี token หรือ credential หลุดไป client
- ไม่มีการเขียนข้อมูลลง database ใน MVP นี้
