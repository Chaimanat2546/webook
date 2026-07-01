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
- AWS/S3-backed existing images เป็น legacy สำหรับ create/replace แต่ delete อนุญาตผ่าน Lambda URL เดิมหลัง confirmation
- AWS/S3 operations ที่ห้าม: upload/import รูปใหม่, replace/edit physical file, copy รูปใหม่เข้า AWS/S3
- การแสดงผลรูปเดิมที่มาจาก AWS/S3 ยังใช้ต่อได้ตาม behavior ปัจจุบัน
- Storage adapter ต้องอยู่ฝั่ง server เท่านั้น และเลือก provider จาก `images.image_url` ที่อ่านจาก database ไม่ใช่ค่าที่ client ส่งมาโดยตรง
- ห้ามเพิ่ม provider column ใหม่สำหรับแยก storage source ใน MVP นี้
- New R2 house files use key prefix `houses/{property_id}/...` on the shared media Worker/R2 bucket.
- AWS/S3 physical delete uses signed server-side S3 `DELETE` requests with `AWS_REGION`, `AWS_BUCKET`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY`.
- AWS/S3 delete is storage-first: keep the `images` row if Lambda delete fails or if the image URL still responds after delete, so admins can retry.
- New house image uploads should arrive at the server as resized WebP files from the admin client.
- Server validation remains authoritative and rejects unsupported types, including GIF.
- Upload partial failures are shown as muted, unsaved cards in the current zone grid, with a failed-upload summary and retry/remove actions per failed image.
- Bulk delete partial failures stay in the delete queue with failed status and retry; the client calls the single-image delete action per image so progress is visible.

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
- Bulk delete flows that need per-image progress must not use one bulk server action; the client should process one trusted deletable image id at a time.
- ห้าม expose R2 credential, AWS/S3 credential, Bearer token, หรือ Authorization header ไป client

## Testing Checklist

- token ไม่ถูกส่งไป client
- เรียก provider ผ่าน server เท่านั้น
- R2 upload/create สำเร็จผ่าน server adapter
- R2 replace/edit สำเร็จผ่าน server adapter
- R2 delete สำเร็จหลัง confirmation
- AWS/S3 delete path สำเร็จผ่าน server-side adapter และใช้ URL จาก `image_name` ที่ validate แล้ว
- AWS/S3 upload หรือ replace/edit ถูกปฏิเสธ
- unknown provider/source ถูกปฏิเสธเมื่อพยายาม mutate ไฟล์จริง
- provider timeout แล้วแสดง error
- delete physical file ต้อง confirmation
- cancel แล้วไม่ลบ
- physical delete fail แล้วแจ้งเตือน
- database delete fail แล้วแจ้ง error
- bulk delete แสดง progress รายรูปและค้างรายการที่ fail ไว้ให้ retry
- ไม่มี open image proxy
- ไม่มี arbitrary external URL fetch
