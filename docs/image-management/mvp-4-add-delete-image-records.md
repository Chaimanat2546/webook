# MVP 4: Add and Delete Image Records

## Goal

เพิ่มความสามารถในการเพิ่มรูปและลบรูปในระดับ database record

MVP นี้ต้องเริ่มจัดการ validation จริงจังขึ้น แต่ยังไม่จำเป็นต้องเชื่อม delete ไฟล์จริงจนกว่าจะยืนยัน external provider behavior ชัดเจน

## In Scope

- เพิ่มรูปจาก `image_name` หรือ URL ตามที่ project รองรับ
- validate extension
- validate duplicate
- validate `https` เมื่อใช้ URL
- เพิ่ม record ใน `images`
- ลบ record ใน `images`
- ถ้าการลบเกี่ยวข้องกับไฟล์จริง ต้องมี confirmation ก่อน
- ถ้าลบ cover แล้วยังมีรูปอื่น ต้องเลือก cover ใหม่ก่อน save

## Storage Boundary

- MVP นี้ใช้ draft UI แบบ advertisement: เลือกรูป/ลบรูปในหน้า แล้วค่อยบันทึกพร้อมกัน
- รูปใหม่ upload ไป Cloudflare R2 ตอน save แล้วเพิ่ม record ใน `images`
- record ใหม่ที่ผูกกับไฟล์จริงต้องใช้ Cloudflare R2 เป็น writable provider เท่านั้น
- AWS/S3-backed images เป็น legacy/display-only ชั่วคราว ยังใช้แสดงผลได้ แต่ยังไม่ให้ลบไฟล์จริง และห้ามสร้างหรือแก้ไฟล์จริงบน AWS/S3
- ใช้ `images.image_url` เป็น discriminator ฝั่ง server สำหรับแยก AWS/S3 legacy กับ R2 ห้ามรับ provider จาก client และห้ามเพิ่ม provider column ใหม่
- AWS/S3 physical delete ปิดไว้ก่อนจนกว่าจะมี delete API/secret และ failure behavior ที่ชัดเจน

## Out of Scope

- ลบไฟล์จริงโดยไม่มี confirmation
- สร้าง open image proxy
- เพิ่ม provider config ใหม่โดยไม่มีเหตุผล
- advanced upload
- image optimization

## Rules

- `image_name` เป็น source of truth
- `image_url` ไม่ใช่ source of truth
- ห้ามเพิ่มรูปซ้ำในบ้านเดียวกัน
- ถ้าบ้านมีรูป ต้องมี cover เพียง 1 รูป
- Delete ต้องมี confirmation ถ้าเกี่ยวข้องกับไฟล์จริง
- ถ้าผู้ใช้ cancel confirmation ห้ามลบ record และห้ามลบไฟล์
- file create/replace/edit สำหรับรูปใหม่ต้องเป็น Cloudflare R2 เท่านั้นเมื่อเข้าสู่ MVP 5
- AWS/S3 ไม่อนุญาต file operation ใด ๆ ในตอนนี้ รวมถึง delete physical file

## Testing Checklist

- เพิ่มรูปได้
- เพิ่มรูปซ้ำไม่ได้
- extension ที่ไม่รองรับถูกปฏิเสธ
- URL ที่ไม่ใช่ `https` ถูกปฏิเสธ
- ลบรูป R2 ได้หลัง confirmation
- cancel confirmation แล้วไม่ลบ
- ลบ cover แล้วต้องเลือก cover ใหม่ก่อน save
- operation ที่พยายามสร้าง แก้ หรือลบไฟล์จริงบน AWS/S3 ต้องถูกปฏิเสธ
- รูปใหม่ใช้ key prefix `houses/{property_id}/...` และเก็บ full Worker URL ใน `images.image_url`
- หลังเพิ่ม/ลบแล้วข้อมูล reload ถูกต้อง
