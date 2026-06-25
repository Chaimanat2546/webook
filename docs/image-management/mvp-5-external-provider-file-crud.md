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

## Testing Checklist

- token ไม่ถูกส่งไป client
- เรียก provider ผ่าน server เท่านั้น
- provider timeout แล้วแสดง error
- delete physical file ต้อง confirmation
- cancel แล้วไม่ลบ
- physical delete fail แล้วแจ้งเตือน
- database delete fail แล้วแจ้ง error
- ไม่มี open image proxy
- ไม่มี arbitrary external URL fetch
