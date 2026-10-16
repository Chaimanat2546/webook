# ผลตรวจ Range picker และชุดเทียบอิสระ

วันที่ 2026-10-16 · Asia/Bangkok

สถานะ: ทำ implementation และทดสอบในเครื่องแล้ว ส่งงานเป็น PR เข้า staging โดยยังไม่ merge หรือ deploy

- Branch: `codex/independent-analytics-comparison`
- Worktree: `C:/Users/USER/.codex/worktrees/hourly-website-analytics/webook`
- BASE: `2f860815c98c4f1ed7a9253978244276b098403b`
- [แบบ](../specs/2026-10-16-independent-analytics-comparison-design.md) · [แผน](../plans/2026-10-16-independent-analytics-comparison.md)

## พฤติกรรมที่เปลี่ยน

วัน เวลา และเว็บไซต์ของช่วงหลักกับชุดเทียบแยกกัน เมื่อแก้ชุดหนึ่งไม่ย้ายอีกชุด ปุ่ม “ใช้จำนวนวันและเวลาตามช่วงหลัก” ยึดวันสิ้นสุดที่เลือกใน draft ของชุดเทียบ แล้วคัดลอกจำนวนวันและเวลา ไม่เปลี่ยนเว็บไซต์ เวลาอยู่ใต้ปฏิทินใน popup เดิม ไม่ระบุเวลาหมายถึง 00:00–24:00

ใช้หน่วยจาก source contract จริง: 1.1 เป็นชั่วโมง ส่วน 1.0/1.2 เป็นวัน รวมถึงรายงานเดือนแบบ implicit ที่มีเพียงวันแรกของเดือน กราฟต่างหน่วยแยกกัน ชั่วโมงที่ clocks ต่างกันก็แยกกัน รายวันซ้อนตามลำดับวันที่เลือก โดย tooltip แสดงวันที่จริง ไม่มีการเติมศูนย์แทนข้อมูลที่หาย

งด % เมื่อเว็บไซต์ไม่ได้อยู่ทั้งสองชุด หน่วย/จำนวนวัน/clocks ต่างกัน ข้อมูลโหลดไม่ได้หรือไม่ครบ หรือยังไม่เริ่ม/ไม่จบช่วงเวลา แสดงเหตุผลทั้งหมดในรายละเอียด ยอดจริงยังคงเดิม และแสดงระยะเวลาที่ร้องขอแยกจากความครบของข้อมูล

## การตรวจอัตโนมัติ

| ตรวจ | ผลรอบสุดท้าย |
| --- | --- |
| `npm.cmd run build` | exit 0; regenerate `public/sw.js` แล้ว |
| `npm.cmd run verify` | exit 0; typecheck, ESLint, tests |
| Node tests | 1,105 tests: ผ่าน 1,101 / ข้าม 4 / ล้มเหลว 0 |
| ESLint | 0 errors; 11 warnings เดิมในไฟล์นอกขอบเขตงาน |
| Regression หลังรีวิว | 3 tests ผ่าน รวมสี prior-only, จำนวนเว็บตามเหตุผล และ pending controls |
| `git diff --check` | ผ่าน |

ทดสอบ policy ครอบคลุม 16 ordered pairs, clocks ยาวเท่ากันแต่คนละเวลา, ช่วง 3/7 วัน, overlap, missing site, failed-first, partial/retention ระดับ microsecond, ก่อนเริ่ม/ระหว่าง/หลังจบ และฐาน 0 ใช้ RED → GREEN ทั้ง regression หลักและสองข้อจาก reviewer

Cross-project integration ใช้ producer validator/HTTP guard/RPC จริงและ consumer Webook กับฐาน PostgreSQL ชั่วคราว: รายชั่วโมง 9 ชั่วโมงได้ 18 views, 23:00–24:00 ได้ 3, unauthorized ได้ 401 และ recurring daily window ได้ [2,2,2] รวม 6 เทียบเต็มวัน 12 โดยใช้ range API request เดียว ไม่แก้ API/SQL ของ producer ในงานนี้

## เบราว์เซอร์จริง

ใช้ Edge และ component จริงของ Dashboard/หน้ารายละเอียด ผ่าน local fixture `http://127.0.0.1:3102` ที่ต่อ SQL/HTTP ข้างต้น สถานะ partial/failed/prior-only เป็นข้อมูลจำลองใน component fixture และมีป้ายระบุบนหน้าทดสอบ

`S24` = วันเดียวเต็มวัน, `ST` = วันเดียว 09–18, `R24` = หลายวันเต็มวัน, `RT` = หลายวัน 09–18

| คู่เงื่อนไข | กราฟ | % ของเว็บที่ข้อมูลครบ |
| --- | --- | --- |
| S24/S24, ST/ST, R24/R24, RT/RT | ซ้อน | แสดง |
| S24/ST, ST/S24 | แยก | งด |
| ทุกคู่ single/range ทั้งสองทิศทาง | แยก | งด |
| R24/RT, RT/R24 | ซ้อนรายวัน | งด |

ตรวจครบ 16 คู่ รวมยอดรวม จากนั้นตรวจเพิ่ม 09–12 เทียบ 18–21 (แยกแม้ยาวเท่ากัน), implicit month วันแรก, ongoing/future, partial, failed-first, all-failed และ prior-only ยอดรวมไม่แสดง % ที่ชวนเข้าใจผิด เว็บที่สองซึ่งโหลดสำเร็จใน failed-first ยังแสดง % ได้ตามข้อมูลของตัวเอง

ตรวจการแก้หลักไม่แก้เทียบ และกลับกัน; draft ไม่โหลดใหม่; Apply โหลดครั้งเดียว; Cancel/Escape/คลิกนอก popup ทิ้ง draft; match คืนเงื่อนไขให้เข้ากันโดยไม่ย้าย comparison.to; remove/add สร้างช่วงก่อนหน้าติดกัน; refresh/deep link/Back/Forward รักษาค่า ในหน้ารายละเอียดแก้เวลาเป็น 09–12 แล้วชุดเทียบเต็มวันคงเดิมและได้กราฟแยก

เวลาเริ่มเท่ากับเวลาสิ้นสุดแสดง validation และปุ่ม “ใช้” disabled โดยไม่มี request เพิ่ม Tooltip ใช้แป้นพิมพ์ได้และแสดงวันที่จริงพร้อมช่วงเวลาทั้งสองชุด สี prior-only ใช้ chart-2 คงที่ และเปิด/ซ่อนผ่าน legend ได้โดยยังเก็บเว็บสุดท้ายไว้

| Viewport | ผลตรวจ |
| --- | --- |
| 1280×900 | ปุ่ม/ช่องกรอก 32px; ไม่มี controls ล้น/ซ้อน |
| 360×800 | popup เลื่อนได้ถึงเวลาและ footer; controls 32px; ลูกศร 32×32 |
| 390×844 | ชุดเทียบและช่องเวลา 32px; ลูกศร 32×32; ไม่มีล้น/ซ้อน |
| 430×932 | ปฏิทิน/ช่องเวลา 32px; ลูกศร 32×32; หลายเหตุผลและ detail popup ไม่ล้น |

วัดหลัง animation จบ ช่องเวลาอยู่ต่ำกว่า calendar ในทุกตัวอย่าง ตรวจไม่มี browser console error และคืน viewport แล้ว

หลักฐานอยู่ที่ `C:/Users/USER/.codex/visualizations/2026/10/16/01a142b4-0ae6-7502-b0d3-465747aa3da8/`: `comparison-matrix.json`, `comparison-special-cases.json`, `comparison-mobile.json`, `independent-comparison-desktop-final.png`, `independent-comparison-mobile-360.png`, `independent-comparison-mobile-390.png`, `independent-comparison-mobile-430.png`

**ขอบเขตหลักฐาน:** browser fixture ใช้ router adapter จึงยืนยัน UI/URL/SQL/HTTP ในเครื่อง ไม่ใช่ authenticated Next.js navigation หรือ deployment จริง การ disable ระหว่าง React transition ตรวจด้วย component probe ที่กำหนด pending=true; ยังไม่ได้ทดสอบ network latency และการกดซ้ำระหว่าง Next.js server navigation บน Staging งานนี้ยังไม่ได้ deploy จึงไม่มีผลยืนยันบน Staging/Production

## Review และสภาพงาน

Reviewer อิสระตรวจ working diff เทียบ BASE รวมไฟล์ untracked พบ P2 สองข้อ: สี prior-only ไม่ตรงระหว่าง overlay/separate และจำนวนเว็บในข้อความ error นับรวมคนละเหตุผล แก้ทั้งสองพร้อม regression ที่ fail ก่อนแก้และ pass หลังแก้ แล้วรัน build/verify ใหม่ ไม่พบประเด็นอื่นจาก review

ใช้ worktree เดิมที่แยกไว้และสร้าง branch ใหม่ เพื่อรักษาเอกสารที่ผู้ใช้อนุมัติและ dependencies ไม่เปลี่ยน checkout หลัก ไม่เพิ่ม dependencies/เปลี่ยน secrets/config deployment เก็บ ledger ของแผนไว้ใน `.superpowers/sdd/2026-10-16-independent-analytics-comparison/` เพราะงานยังไม่ commit

ปิดเฉพาะ fixture server ของงานและลบฐานทดสอบ `webook_hourly_test_38804` แล้ว ตรวจฐานคงเหลือ 0 ไม่หยุด server ของผู้ใช้ที่ port 3000 และไม่แก้ฐานจริง

## แก้ไขตาม feedback: ปุ่มใน Date picker และแนวระดับ

ผู้ใช้ให้เปลี่ยนชื่อและย้าย action เข้าปฏิทินของชุดเทียบ: ใช้ callback selectDraft ของ ThaiDateRangePicker เดิม ปรับ draft วัน/เวลาพร้อมกันโดยไม่ commit จนกดใช้ Cancel/Escape คืนค่าเดิม การปรับอ้างวันสิ้นสุดที่กำลังเลือก ไม่ใช่วันสิ้นสุดที่เคยบันทึก

ตรวจ Edge ผ่าน local fixture อีกครั้ง: desktop 1280×900 ตัวเลือกหลัก/เทียบ top=222px ทั้งคู่และสูง32px; มือถือ360×800/390×844/430×932 controls32px/ลูกศร32×32 ไม่มี horizontal overflow หรือ overlap ปุ่มใหม่อยู่ใน popup และไม่ล้นภายในปุ่ม ตรวจกดปรับไม่เพิ่ม request; Apply เพิ่มหนึ่ง request และเปลี่ยนเฉพาะชุดเทียบ; Cancel และ Escape ทิ้ง draft; คัดลอกเต็มวันปิดช่องเวลา และคัดลอก09–18 เปิดช่องพร้อมค่าถูกต้อง ตรวจ action ในหน้ารายละเอียดเว็บไซต์ด้วย ไม่มี console error

รอบสุดท้าย build และ verify exit0: 1105tests/1101pass/4skip/0fail, ESLint0errors/11warningsเดิม เพิ่ม regression picker-match ที่ fail ก่อนแก้และ pass หลังแก้ Self-review callback/ทุก caller ผ่าน หลักฐานใหม่ picker-layout-desktop.png, picker-layout-popup-desktop.png, picker-layout-mobile-{360,390,430}.png และ picker-layout-measurements.json ในโฟลเดอร์หลักฐานเดิม เก็บข้อจำกัด router fixture ตามรายงานข้างต้น ยังไม่ merge/deploy

## ช่องวันที่กว้างตามข้อความ

นำ equal-width grid และ w-full/flex-1 ที่ทำให้ช่องวันที่ขยายออก เปลี่ยนเป็น flex-wrap + w-fit/max-w-full โดยใช้ text-xs เท่ากันทั้งสองชุด คง32px ไม่เปลี่ยนพฤติกรรม picker/policy

ตรวจ Edge actual components ผ่าน local SQL/HTTP fixture อีกครั้งที่1280×900: RT/ST กว้าง301.66/189.67px และ top222px เท่ากัน; single/full-day ทั้งคู่203.98px; range/time ทั้งคู่301.66px; range/full-day ทั้งคู่285.08px ทุกกรณีสูง32px ความกว้างข้อความเท่ากับพื้นที่แสดงข้อความ ไม่ยืดเป็นครึ่งการ์ด

มือถือ360×800/390×844/430×932: กลุ่มขึ้นบรรทัดเมื่อพื้นที่ไม่พอ ช่องวันที่สูง32px ไม่มี controls ล้นแนวนอน และ document scrollWidth เท่ากับ clientWidth ทุกขนาด ตรวจปุ่มปรับใน popup ยังคงอยู่ สูง32px/ลูกศร32×32 ไม่มี console error คืน viewport และปิดแท็บทดสอบแล้ว

Build/verify รอบ compact-picker exit0:1105tests/1101pass/4skip/0fail; lint11warningsเดิม0errors และ diff --check ผ่าน เปลี่ยนเฉพาะ CSS layout จึงไม่เพิ่ม tests ที่ตรวจ className ซ้ำ implementation หลักฐาน compact-picker-desktop.png, compact-picker-mobile-{360,390,430}.png, compact-picker-measurements.json ในโฟลเดอร์หลักฐานเดิม

## ตรวจความต่างระหว่าง fixture กับข้อมูลจริงก่อนส่ง PR

ภาพกราฟเส้นคงที่2ครั้งต่อวันมาจาก local disposable SQL fixture ไม่ใช่ข้อมูลเว็บไซต์จริง ตรวจหน้า Dashboard Staging ในเบราว์เซอร์ที่ผู้ใช้ login อยู่แล้วพบรายงาน14–16ต.ค.และข้อมูลครบ5เว็บไซต์พร้อมกราฟที่เปลี่ยนค่ารายวัน ข้อมูลจริงไม่ได้หาย แต่ Staging ยังเป็นโค้ดก่อน PR นี้ จึงไม่ถือเป็นหลักฐานว่าแพตช์ใหม่ผ่าน authenticated Next.js navigation กับข้อมูลจริง ต้องตรวจหลัง merge/deploy Staging โดยได้รับคำสั่งแยก

ภาพ staging-real-analytics.png อยู่ในโฟลเดอร์หลักฐานเดิม แยกจากภาพ local fixture ตรวจ verify ก่อน commit อีกครั้ง:1105tests/1101pass/4skip/0fail
