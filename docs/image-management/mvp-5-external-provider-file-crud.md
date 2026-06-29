# MVP 5: External Provider and Physical File CRUD

## Goal

เชื่อมการจัดการรูปกับ external image provider หรือ storage จริง

MVP นี้เป็นรอบที่เสี่ยงที่สุด เพราะเกี่ยวข้องกับ Bearer token, external API, และการลบไฟล์จริง

## In Scope

- อ่าน provider/API ที่มีอยู่จริงในโปรเจกต์
- ใช้ Bearer token ฝั่ง server เท่านั้น
- import/upload ผ่าน provider ถ้าระบบรองรับ
- delete physical file หลัง confirmation
- จัดการ partial failure
- ป้องกัน token หลุดไป client
- เพิ่ม server-side validation เฉพาะเมื่อจำเป็นและได้รับอนุมัติ

## Provider Policy

- Cloudflare R2 เป็น writable storage เดียวสำหรับรูปบ้านพักใหม่หรือรูปที่ถูก replace/edit ผ่าน admin tool
- R2 operations ที่อนุญาต: upload/create, replace/edit physical file, delete physical file
- AWS/S3-backed existing images เป็น legacy/delete-only
- AWS/S3 operations ที่ห้าม: upload/import รูปใหม่, replace/edit physical file, copy รูปใหม่เข้า AWS/S3
- การแสดงผลรูปเดิมที่มาจาก AWS/S3 ยังใช้ต่อได้ตาม behavior ปัจจุบัน
- Storage adapter ต้องอยู่ฝั่ง server เท่านั้น และเลือก provider จาก `images.image_url` ที่อ่านจาก database ไม่ใช่ค่าที่ client ส่งมาโดยตรง
- ห้ามเพิ่ม provider column ใหม่สำหรับแยก storage source ใน MVP นี้

## Out of Scope

- เปิด image proxy อิสระ
- รับ URL จาก domain ใดก็ได้
- expose provider credential ไป client
- optimize รูปขั้นสูง
- bulk processing ขนาดใหญ่

## Rules

- ต้องอ่าน code/provider ปัจจุบันก่อน implement
- ห้ามเดา endpoint เอง
- ห้ามสร้าง env ใหม่โดยไม่อธิบายเหตุผล
- external API token ต้องอยู่ฝั่ง server เท่านั้น
- delete physical file ต้องถามยืนยันก่อนเสมอ
- ต้อง handle กรณี database success แต่ provider fail
- ต้อง handle กรณี provider success แต่ database fail
- ถ้า provider/source ไม่ชัดเจนหรือไม่รองรับ operation ต้อง block operation และแจ้ง error
- ห้าม expose R2 credential, AWS/S3 credential, Bearer token, หรือ Authorization header ไป client

## Testing Checklist

- token ไม่ถูกส่งไป client
- เรียก provider ผ่าน server เท่านั้น
- R2 upload/create สำเร็จผ่าน server adapter
- R2 replace/edit สำเร็จผ่าน server adapter
- R2 delete สำเร็จหลัง confirmation
- AWS/S3 delete-only path สำเร็จหลัง confirmation
- AWS/S3 upload หรือ replace/edit ถูกปฏิเสธ
- unknown provider/source ถูกปฏิเสธเมื่อพยายาม mutate ไฟล์จริง
- provider timeout แล้วแสดง error
- delete physical file ต้อง confirmation
- cancel แล้วไม่ลบ
- physical delete fail แล้วแจ้งเตือน
- database delete fail แล้วแจ้ง error
- ไม่มี open image proxy
- ไม่มี arbitrary external URL fetch
