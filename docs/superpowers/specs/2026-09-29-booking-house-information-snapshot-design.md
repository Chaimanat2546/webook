# แบบออกแบบ Snapshot ข้อมูลที่พักใน Booking

## เป้าหมาย

ให้แต่ละ booking เก็บข้อมูลที่พักซึ่งแก้ไขได้ โดยไม่เปลี่ยนข้อมูลต้นทางของ
listing หรือ house และให้ Production เป็นแหล่งอ้างอิง schema เพียงแห่งเดียว

## Contract ของ Production

- `public.bookings` มี `insurance numeric` และ `extra_person numeric` ซึ่งรับ
  ค่า `null` ได้ และมีค่าเริ่มต้น `0.00`
- `public.bookings` ยังไม่มี `checkin_time` และ `checkout_time`
- `public.listings` มี `insurance_fee`, `extra_beds`, `checkin_time` และ
  `checkout_time` ใช้เป็นข้อมูลต้นทางเฉพาะตอนสร้าง booking
- RPC สำหรับสร้างและแก้ booking ยังไม่รับค่าข้อมูลที่พักทั้งสี่ค่า

## รูปแบบข้อมูล

สร้าง forward migration ใหม่หนึ่งไฟล์เพื่อ:

1. เพิ่ม `checkin_time time without time zone` และ `checkout_time time without
   time zone` ซึ่งรับ `null` ได้ ลงใน `public.bookings`
2. แทนที่ `admin_create_house_booking` และ `admin_update_house_booking` ให้
   JSON contract รับ `insurance`, `extra_person`, `checkin_time` และ
   `checkout_time` พร้อมตรวจสอบค่า และบันทึกลงเฉพาะคอลัมน์ของ booking
3. คง RPC signature, การอนุญาต, optimistic concurrency, การตรวจวันจองทับ,
   audit log และสิทธิ์ execute เดิมไว้

Migration จะไม่เปลี่ยน `listings`, `house`, `agents` หรือ `agent_accounts`
และจะไม่แก้ไข migration เก่า

## ลำดับการทำงานของแอป

เมื่อสร้าง booking ใหม่ service จะอ่าน listing ที่เลือกเพียงครั้งเดียว แล้ว map
ค่าดังนี้:

| ข้อมูลจาก listing | Snapshot ใน booking |
| --- | --- |
| `insurance_fee` | `insurance` |
| `extra_beds` | `extra_person` |
| `checkin_time` | `checkin_time` |
| `checkout_time` | `checkout_time` |

ค่าที่กรอกจากฟอร์มโดยตรงจะมีผลเหนือค่าเริ่มต้นจาก listing สำหรับ booking ที่มี
อยู่แล้ว UI จะอ่านและเขียนเฉพาะค่าจาก booking โดยไม่โหลด listing เพื่อใช้เป็น
fallback

## UI และขอบเขตของระบบ

ฟอร์ม “ข้อมูลที่พัก” ใน booking จะแสดงและแก้ไขค่า insurance, ราคาคนเสริม,
เวลาเช็คอิน และเวลาเช็คเอาท์ โดยข้อความและ TypeScript type ใช้ชื่อ field ของ
booking เท่านั้น ชื่อ field ของ listing จะถูกจำกัดไว้ใน repository/service ที่
map ค่าเฉพาะตอนสร้าง

งานนี้จะปรับ TypeScript contract, validation, repository, service, server
action, RPC payload, tests และเอกสารที่เกี่ยวข้องกับ booking รวมทั้งนำการอ้างอิง
`insurance_fee` และ `extra_beds` ออกจาก booking ทั้งหมด

## การจัดการข้อผิดพลาดและ Validation

- จำนวนเงินรับ `null` ได้ ต้องไม่ติดลบ และมีทศนิยมไม่เกินสองตำแหน่ง
- เวลา รับ `null` ได้ และอยู่ในรูปแบบ `HH:mm` หรือ `HH:mm:ss`
- key หรือค่าของ payload ที่ไม่ถูกต้องจะคืน error เดิมคือ
  `booking_invalid_input`
- คงการป้องกันการเขียนทับข้อมูลเก่าและการตรวจสิทธิ์เดิมไว้

## การทดสอบและตรวจสอบ

Tests ต้องครอบคลุมการ map ค่า listing ไปเป็น booking snapshot, การ override
จากฟอร์ม, การแก้ booking ที่ไม่ถูกกระทบเมื่อ listing เปลี่ยน, validation ของชื่อ
field, RPC payload contract และ field บน UI ก่อนสรุปงานให้รัน typecheck, lint,
tests ที่เกี่ยวข้อง และ test suite ทั้งหมด

## เงื่อนไขก่อน Deploy

ก่อน apply migration หรือ deploy ไป Staging ต้องตรวจและสรุป Production schema
อีกครั้ง แล้วรอการยืนยันอย่างชัดเจน การ deploy Staging ใช้เฉพาะ
`npm run deploy:cf:staging` หลังตรวจสอบครบถ้วน
