# MVP 2: Draft UI Interaction

## Goal

เพิ่มความสามารถให้ผู้ใช้ทดลองจัดการรูปบน UI แบบ staged changes แต่ยังไม่บันทึกจริง

MVP นี้โฟกัสที่ UX และ state management ก่อน persistence

## In Scope

- เลือกรูปเป็น cover ใน UI
- เปลี่ยน `image_zone` ใน UI
- reorder รูปใน UI
- mark รูปเป็น deleted ใน UI
- แสดง unsaved changes
- ปุ่ม reset/cancel changes
- validate เบื้องต้นก่อน save
- อ่านค่า `image_zone` จาก database ก่อนสร้าง option

## Out of Scope

- บันทึกลง database
- เพิ่มรูปจริง
- ลบไฟล์จริง
- เรียก external provider CRUD
- upload file

## Rules

- การแก้ไขทั้งหมดเกิดใน client state หรือ draft state เท่านั้น
- refresh หน้าแล้วข้อมูลต้องกลับไปเป็นข้อมูลจาก database
- ห้ามเรียก API update/delete/create จริงใน MVP นี้
- ถ้าลบ cover ใน draft แล้วยังมีรูปอื่น ต้องบังคับเลือก cover ใหม่ก่อนถือว่า valid

## Testing Checklist

- เปลี่ยน cover ใน UI ได้
- มี cover ได้เพียง 1 รูปใน draft
- เปลี่ยน `image_zone` ใน UI ได้
- reorder แล้ว `image_move` ใน draft เรียงต่อเนื่อง
- mark deleted แล้วรูปไม่แสดงใน draft
- reset แล้วกลับเป็นข้อมูลเดิม
- ยังไม่มีการ update database จริง
