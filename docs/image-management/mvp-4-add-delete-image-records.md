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

## Testing Checklist

- เพิ่มรูปได้
- เพิ่มรูปซ้ำไม่ได้
- extension ที่ไม่รองรับถูกปฏิเสธ
- URL ที่ไม่ใช่ `https` ถูกปฏิเสธ
- ลบรูปได้หลัง confirmation
- cancel confirmation แล้วไม่ลบ
- ลบ cover แล้วต้องเลือก cover ใหม่ก่อน save
- หลังเพิ่ม/ลบแล้วข้อมูล reload ถูกต้อง
