# MVP 3: Save Image Metadata

## Goal

บันทึก metadata ของรูปลง database โดยยังไม่ยุ่งกับไฟล์จริง

MVP นี้ใช้สำหรับบันทึกการเปลี่ยนแปลงที่เกี่ยวกับ:

- `image_zone`
- `image_move`
- cover ผ่าน `image_zone = cover`

## In Scope

- save staged `image_zone`
- save staged `image_move`
- save cover state
- validate ก่อน save
- refresh/reconcile ข้อมูลหลัง save
- แสดง success/error หลัง save

## Out of Scope

- เพิ่มไฟล์รูปใหม่
- ลบไฟล์จริง
- upload file
- external provider delete
- external provider upload

## Rules

- ก่อน save ต้อง validate ว่าถ้ามีรูป ต้องมี `cover` เพียง 1 รูป
- `image_move` ต้องเป็นเลขต่อเนื่อง 1, 2, 3, 4, ...
- ห้ามมีรูปซ้ำใน payload
- ห้าม save ถ้ามีรูปหายจาก draft โดยไม่ได้ตั้งใจ
- ถ้า save fail ห้ามแสดงว่าสำเร็จ
- หลัง save สำเร็จควรโหลดข้อมูลจาก server ใหม่

## Testing Checklist

- save `image_zone` ได้
- save `image_move` ได้
- save cover ได้
- มี cover ได้เพียง 1 รูปหลัง save
- save fail แล้วแสดง error
- validation fail แล้วไม่เรียก save API
- หลัง save แล้ว reload ข้อมูลยังถูกต้อง
