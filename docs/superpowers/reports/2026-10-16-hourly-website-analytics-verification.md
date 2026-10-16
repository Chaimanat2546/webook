# ผลตรวจสถิติรายชั่วโมง — 2026-10-16

## สถานะงาน

เพิ่ม producer contract 1.1 และเชื่อม Webook ตามแบบแล้ว ผลตรวจนี้บันทึกก่อน commit และเปิด PR งานอยู่ใน worktrees แยก โดยยังไม่ได้ migrate online หรือ deploy:

- Producer: C:/Projects/baan-pool-villa/.superpowers/worktrees/hourly-site-analytics — branch codex/hourly-site-analytics, base 3eaf6c2
- Consumer: C:/Users/USER/.codex/worktrees/hourly-website-analytics/webook — branch codex/hourly-website-analytics, base 84885cd

## Automated verification

| ตรวจ | ผลจริง |
|---|---|
| Producer npm test (Vitest) | 285 files, 2,425 tests ผ่าน |
| Producer ESLint / tsc --noEmit / Next production build | ผ่าน |
| Docker disposable SQL runner | ผ่านทั้ง 1.0/1.1, ไทยเที่ยงคืน, snapshot, coverage, sums, villa filter, role/tenant denial, migration replay |
| Legacy SQL หลัง upgrade | ผ่าน 2,000 villas, ปฏิเสธ 10,001 villas, prune batch validation/watermark, exact retention cutoff และ rollback |
| Webook npm run verify | TypeScript ผ่าน; ESLint 0 errors/11 warnings เดิม; 1,059 tests ผ่าน, 4 skip เดิม, 0 failed (รวม 1,063 tests) |
| Webook npm run build | ผ่าน รวม regenerate public/sw.js ที่ตรง source |
| Diff whitespace / integration-script targeted ESLint | ผ่าน |
| Producer SQL + HTTP guard/validator → Webook client/parser/service | ผ่านจริงในเครื่อง ไม่ใช่ mock aggregate |

Integration ใช้ฐานข้อมูลที่ runner สร้างเองภายใน Docker PostgreSQL ที่มีอยู่ ไม่อ่าน .env และไม่เชื่อม DB ภายนอก Fixture 09:00–18:00 ได้ 9 buckets/18 views, 23:00–24:00 ได้ 1 bucket/3 views และ request ไม่มีสิทธิ์ได้ HTTP 401 มีการตรวจ sums/clock/identity ผ่าน parser จริง ฝั่ง producer ใช้ validation/guard/RPC จริง โดย local HTTP fixture adapter แทน Next route transport; route unit tests ตรวจ wiring/authorization/no-store แยกต่างหาก

SQL runtime ใช้ Docker แทน PGlite ที่ยังไม่ติดตั้ง ไม่มี dependency หรือ lockfile เปลี่ยน Docker test runner ลบเฉพาะฐานข้อมูลชั่วคราวที่ตัวเองสร้าง เมื่อจบการรัน

## Browser verification

ใช้ Edge จริงกับ application components/CSS/font ของ production build และข้อมูลจาก API/SQL fixture ข้างต้น Router ใน local fixture เป็น navigation adapter สำหรับทดสอบ ไม่ได้แก้ production router หรือเพิ่ม fixture route ลงแอป

- Dashboard เลือก 09:00–18:00: แกน 09:00 ถึง 17:00 และยอด 18; เปลี่ยนเวลาเริ่มเป็น 10:00 แล้วกดใช้เวลา ได้ 8 buckets/17 views
- มือถือเลือกเวลาสิ้นสุด 24:00 ได้; 09:00–24:00 ได้ยอด 30 จริงตาม fixture
- เปลี่ยนจากวันเดียวเป็น preset 7 วันล่าสุดจริงใน browser: ช่วง 2026-10-10–2026-10-16 แสดงกราฟรายวัน ซ่อนตัวเลือกเวลา และลิงก์ไม่มี time fields
- ปุ่มใช้เวลาปิดเมื่อค่าไม่เปลี่ยน และเมื่อเวลาเริ่มเท่ากับเวลาสิ้นสุดมีข้อความ invalid โดยไม่ navigate
- เพิ่ม comparison คัดลอกช่วงเวลาเดิมไปวันก่อนหน้า มี primary/comparison selectors แยกกันและชื่อ/ID ไม่ซ้ำ
- เปิดรายละเอียดเว็บไซต์และรายการบ้านทั้งหมด ยังคง 09:00–18:00; graph/details/search/date/sort/site/time controls สูง 32px และปุ่มค้นหา 32 × 32px
- Input จำนวนวันทั้งสองช่องในปฏิทินสูง 32px; ลูกศร Previous/Next Month วัด 32 × 32px
- ช่วงอนาคต 18:00–24:00 ของวัน snapshot แสดง “ยังไม่ถึงช่วงเวลาที่เลือก” ทั้ง trend และหลังสลับ total view ไม่อ้างว่าเป็น observed zero
- Desktop ไม่เกิด page horizontal overflow

Responsive ใช้ iframe viewport จริงใน Edge เพราะ browser API ไม่มี setter สำหรับ device viewport จึงตรวจ CSS media queries/layout ที่ 360 × 800, 390 × 844 และ 430 × 932 ได้ โดยไม่ได้อ้างว่าเป็นการทดสอบ Safari/iOS/Android หรือ touch hardware:

| Viewport | document clientWidth / scrollWidth (px) | visible controls height | Horizontal overflow / overlaps |
|---|---:|---:|---|
| 360 × 800 | 345 / 345 | 32px | 0 / ไม่มี |
| 390 × 844 | 375 / 375 | 32px | 0 / ไม่มี |
| 430 × 932 | 415 / 415 | 32px | 0 / ไม่มี |

clientWidth น้อยกว่า viewport 15px เพราะ Windows classic scrollbar; ไม่ใช่ overflow เมื่อเปิด popup scroll lock ค่า clientWidth อาจเท่ากับ viewport ตรวจเปรียบเทียบกับค่าของ document ใน state เดียวกันเสมอ

ชุดเปรียบเทียบบนมือถือ 390px มี controls สองชุดสูง 32px, ไม่มี overflow/overlap; Calendar และ Select portals อยู่ใน viewport และเลื่อนเนื้อหาภายในได้ Measurement คัดเฉพาะ controls ที่เห็นจริงด้วย hit test จึงไม่นับการวาง popup ทับ background หรือ rows ที่ถูก scroll container clip ว่าเป็นปุ่มซ้อนกัน

หลักฐานอยู่ใน C:/Users/USER/.codex/visualizations/2026/10/16/01a142b4-0ae6-7502-b0d3-465747aa3da8/button-sizing/:

- hourly-desktop.jpg
- hourly-mobile-360.txt / hourly-mobile-390.txt / hourly-mobile-430.txt
- hourly-mobile-comparison.jpg / hourly-mobile-comparison.txt
- hourly-mobile-calendar.jpg / hourly-mobile-calendar-state.txt

## Review และการแก้

มี fresh read-only whole-change review ของทั้งสอง repos และแก้ findings พร้อม red→green regression:

1. เปลี่ยน business date แล้ว analytics clock/date หาย — คงเฉพาะ analytics params ที่ allowlist
2. วันที่ 1 ของเดือนทำ implicit month report กลายเป็น hourly — เก็บ absence ของ explicit date range และไม่แสดง time selectors ใน implicit monthly series
3. Parser รับ rollover date และ sub-millisecond bucket — ตรวจ canonical components/zero fractions ก่อน normalize
4. Coverage watermark ระดับ microsecond — เปรียบเทียบเศษเวลาที่ PostgreSQL เก็บ โดยไม่ถูก Date.parse ตัดทิ้ง
5. Controls ใน details/house/day-month flow ยัง 44/36px — ปรับเป็น 32px และวัด Input/ปุ่มค้นหาจริง
6. Future notice หายเมื่อดู totals — เพิ่ม report-level notice และงดข้อความ observed-no-events ที่ผิดความหมาย
7. SQL regression gate ยังไม่ครอบคลุม legacy stress/retention — เพิ่ม assertions ที่รัน RPC หลัง upgrade จริง
8. Mixed-unit comparison ต้องอธิบายหน่วยต่างกัน ไม่แสดงเหตุผลว่าเวลายังไม่จบทั้งที่ครบแล้ว

## ขอบเขตที่ยังไม่ได้ดำเนินการ

ยังไม่ได้ apply SQL หรือ deploy Staging/Production และไม่ได้ตรวจข้อมูล/สภาพแวดล้อม tenant จริงทั้งห้าเว็บ Registry ของ Webook ปัจจุบันชี้ seller public origins จึงต้องยืนยัน integration targets/credentials ก่อน rollout ตาม spec และให้ producer SQL + Worker พร้อมก่อน consumer Production

Browser fixture ไม่แทนการทดสอบ auth/session/Next navigation บน deployed app หรือ browser engine ของมือถือจริง ประเด็นดังกล่าวเป็น release acceptance หลังได้รับคำสั่ง deploy ไม่ใช่สิ่งที่อ้างว่าผ่านจาก local fixture นี้
