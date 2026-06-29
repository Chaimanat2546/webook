# MVP 1: Read-only Image Display

## Goal

ดึงข้อมูลบ้านพักและรูปภาพจากฐานข้อมูลมาแสดงให้ถูกต้องก่อน

MVP นี้ยังไม่เพิ่มรูป ลบรูป เรียงรูป ตั้ง cover หรือบันทึกข้อมูลใด ๆ

## In Scope

- ตรวจสอบว่า user login แล้ว
- จำกัดการเข้าใช้งานเฉพาะ Administrator
- แสดงรายการบ้านพักทั้งหมดจาก `listings`
- เรียงบ้านที่ `is_active = true` ก่อน `is_active = false`
- ค้นหาบ้านพักจาก `title`, `property_id`, และ `location_zone`
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

หน้านี้เป็น house selector สำหรับเข้าหน้าจัดการรูปเท่านั้น ไม่ใช่หน้าแสดงแกลเลอรีรูป และไม่ใช่หน้าจัดการข้อมูลบ้านพักเต็มรูปแบบ

ข้อมูลที่แสดง:

- `property_id`
- `title`
- `bedrooms`
- `bathrooms`
- `location_zone`
- `is_active`
- ปุ่ม "จัดการรูป"

`id` ใช้เป็น internal field ได้ แต่ไม่จำเป็นต้องแสดงใน UI

Rules:

- แสดงบ้านพักทั้งหมด ทั้ง `is_active = true` และ `is_active = false`
- เรียง `is_active = true` ก่อน `is_active = false`
- มี search input สำหรับค้นหาจาก `title`, `property_id`, และ `location_zone`
- ผลลัพธ์จาก search ยังคงเรียง `is_active = true` ก่อน `is_active = false`
- ไม่แสดง cover image, thumbnail, image placeholder หรือ gallery preview ในหน้านี้
- action ต่อบ้านมีเพียงปุ่ม "จัดการรูป"
- หน้านี้ยังไม่ใช่หน้าจัดการข้อมูลบ้านพักเต็มรูปแบบ
- หน้านี้ทำหน้าที่เป็นทางเข้าไปยังหน้ารูปภาพเท่านั้น
- ห้ามมีปุ่มเพิ่มบ้านพัก แก้ไขบ้านพัก ลบบ้านพัก upload image หรือ import image ใน MVP นี้

Navigation:

- The "manage images" action preserves the current list URL (`page` and `q`) with a `returnTo` query parameter.

Responsive layout:

- Mobile: compact stacked cards แบบไม่มีรูป
- Tablet: compact card/list hybrid แบบไม่มีรูป
- Laptop/Desktop: dense admin table แบบไม่มีรูป

Admin shell:

- Desktop/Laptop: ใช้ left sidebar navigation
- Mobile: ใช้ top app bar พร้อม hamburger menu ที่เปิดเป็น sheet/drawer
- ห้ามใช้ horizontal admin menu ที่เบียดกันบน mobile

## Screen: `/admin/houses/[houseId]/images`

ใช้สำหรับแสดงรูปของบ้านพัก 1 หลัง

ข้อมูลที่แสดง:

- ชื่อบ้านพัก
- `property_id`
- รายการรูปทั้งหมด
- preview รูป
- คลิก card รูปเพื่อเปิด preview รูปขนาดใหญ่ขึ้นแบบ read-only
- `image_name`
- `image_zone`
- `image_move`
- `created_at`
- `updated_at`

Rules:

- ดึงรูปจาก `images` ด้วย `property_id`
- เรียงรูปตาม `image_move` จากน้อยไปมาก
- `image_move` เป็นเลขลำดับ 1, 2, 3, 4, ...
- รูปที่แสดงได้ต้องเปิด preview ขนาดใหญ่ขึ้นได้เมื่อคลิกที่ card โดยไม่แก้ไขข้อมูล
- ยังไม่อนุญาตให้แก้ไขข้อมูล
- ยังไม่อนุญาตให้ลบรูป
- ยังไม่อนุญาตให้ reorder
- ยังไม่อนุญาตให้เปลี่ยน zone
- ยังไม่อนุญาตให้ตั้ง cover

Navigation:

- The back link uses a validated `returnTo` value and falls back to `/admin/houses`.
- Zone navigation preserves `returnTo` so returning to the house list keeps the previous page/search state.
- On mobile, changing zones scrolls the active zone chip into the first visible position without changing the stored zone order.
- The image manager uses a bounded workspace: zones, selected-zone header, inline upload action, and form actions remain visible while the image grid is the primary scroll area for long image sets.
- The selected-zone header keeps the image count in the left detail text and uses the far-right header action slot for the upload button; avoid a duplicate far-right image-count badge.

## Data Source

Database: Supabase Database

Current ordering rule:

- `image_move` is scoped to `property_id + image_zone`, not the whole house.
- The image page sorts images inside each selected zone by `image_move`.
- Zone folder order is separate from `image_move` and should not be inferred from the highest/lowest image number.
- New uploads in later MVPs should assign the next `image_move` from the selected zone only.

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
- กรณีไม่มีบ้านพัก แสดงข้อความ "ยังไม่มีข้อมูลบ้านพัก"
- กรณีค้นหาแล้วไม่พบผลลัพธ์ แสดงข้อความ "ไม่พบบ้านพักที่ค้นหา"

Error:

- โหลดรายการบ้านไม่สำเร็จ
- โหลดรูปไม่สำเร็จ
- ไม่มีสิทธิ์เข้าใช้งาน
- ไม่พบข้อมูลบ้าน
- รูปแสดงไม่ได้

## Testing Checklist

- ต้อง login ก่อนเข้าหน้า image management
- Administrator เข้าใช้งานได้
- Operator เข้าใช้งานไม่ได้ใน MVP นี้
- user ที่ไม่มีสิทธิ์เข้าไม่ได้
- แสดงบ้านพักทั้งหมดจาก `listings`
- บ้านที่ `is_active = true` แสดงก่อน `is_active = false`
- ค้นหาบ้านพักด้วย `title`, `property_id`, และ `location_zone` ได้
- ไม่แสดงรูปหรือ thumbnail ในหน้า `/admin/houses`
- หน้า `/admin/houses` แสดงผลแบบ mobile-first: compact cards บน mobile และ dense table บน desktop
- กดเข้าไปดูรูปของบ้านได้
- โหลดรูปตาม `property_id` ได้
- รูปเรียงตาม `image_move`
- แสดง `image_zone` ได้
- คลิก card รูปเพื่อเปิด preview รูปขนาดใหญ่ขึ้นได้
- แสดง empty state เมื่อบ้านไม่มีรูป
- แสดง error state เมื่อโหลดข้อมูลล้มเหลว
- ไม่มี token หรือ credential หลุดไป client
- ไม่มีการเขียนข้อมูลลง database ใน MVP นี้
