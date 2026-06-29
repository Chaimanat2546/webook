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

- MVP นี้จัดการการเพิ่ม/ลบระดับ database record เป็นหลัก และยังไม่เขียนไฟล์จริงจนกว่า MVP 5 จะยืนยัน provider behavior
- record ใหม่ที่ต้องผูกกับไฟล์จริงในอนาคตต้องเตรียมให้รองรับ Cloudflare R2 เป็น writable provider เท่านั้น
- AWS/S3-backed images เป็น legacy/delete-only ถ้าลบเกี่ยวข้องกับไฟล์จริงต้องทำผ่าน confirmation และห้ามสร้างหรือแก้ไฟล์จริงบน AWS/S3
- ใช้ `images.image_url` เป็น discriminator ฝั่ง server สำหรับแยก AWS/S3 legacy กับ R2 ห้ามรับ provider จาก client และห้ามเพิ่ม provider column ใหม่

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
- AWS/S3 อนุญาตเฉพาะ delete physical file หลัง confirmation

## Testing Checklist

- เพิ่มรูปได้
- เพิ่มรูปซ้ำไม่ได้
- extension ที่ไม่รองรับถูกปฏิเสธ
- URL ที่ไม่ใช่ `https` ถูกปฏิเสธ
- ลบรูปได้หลัง confirmation
- cancel confirmation แล้วไม่ลบ
- ลบ cover แล้วต้องเลือก cover ใหม่ก่อน save
- operation ที่พยายามสร้างหรือแก้ไฟล์จริงบน AWS/S3 ต้องถูกปฏิเสธ
- หลังเพิ่ม/ลบแล้วข้อมูล reload ถูกต้อง
