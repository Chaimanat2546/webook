# WeBooks PWA checklist ตามแนวทางคลิป

ปรับ browser support: 11 กันยายน 2026

ขอบเขตที่ผู้ใช้สั่งล่าสุด: อนุมัติแพ็กเกจ Workbox ที่จำเป็น ดำเนินการหมวด P01–P04, P06–P07 และงานตรวจรับที่เกี่ยวข้อง ส่วน Push Notification (P05, N01–N07) และการลง Store (T01–T04) เป็น deferred ทั้งหมวด ไม่เป็นเงื่อนไขปิดงานรอบนี้

ยึดหัวข้อและ chapter ของ [Progressive web app คืออะไร? — mikelopster](https://www.youtube.com/watch?v=PgLCP3YNB_8) และข้อความใน [สไลด์ประกอบ](https://docs.google.com/presentation/d/18lzCrVsPpznEpnPlunm6IdfJRoCeRSc8xpEWBzWWcfs/edit) ที่ตรวจแล้ว ใช้ร่วมกับ [รายงานวิเคราะห์](pwa-gap-analysis-2026-09-11.md) และ [คู่มือระบบปัจจุบัน](pwa.md)

นี่คือ checklist ประยุกต์จากคลิปสำหรับ WeBooks ไม่ใช่ transcript; ยังดึงคำบรรยายเต็มคลิปไม่ได้ รายละเอียด implementation และเกณฑ์รับงานเป็นการประยุกต์เข้ากับข้อจำกัดของโปรเจกต์

## Checklist ภาพรวม 7 ข้อตามภาพอ้างอิง

เพิ่มจากภาพที่ผู้ใช้ส่ง: ใช้ทั้ง 7 ข้อนี้เป็นรายการภาพรวม และใช้รหัสด้านล่างตรวจรับรายละเอียด ไม่ติ๊กภาพรวมจนรายการที่เกี่ยวข้องในขอบเขตผ่านจริง หากมี deferred ให้คงช่องภาพรวมว่างและระบุส่วนที่ยังขาด

- [ ] P01 **FAST (ใช้งานได้ทันที)** — เปิดแอปและตอบสนองต่อการกดได้รวดเร็ว มี feedback ระหว่างรอ พร้อมผลวัดตาม performance budget → M01–M02, M04–M05
- [ ] P02 **Native Mobile API (Camera, Geolocation, anything in Hardware)** — ระบุ API ที่ใช้กับงานจริง ตรวจการรองรับและ permission พร้อม fallback; แจกแจง API ที่ไม่ใช้เป็น N/A รายตัว → A01–A07
- [ ] P03 **UI App-like Experience** — หน้าตาและการใช้งานเหมาะกับแอปบนมือถือ ทั้ง navigation, loading, touch, keyboard, safe area และ accessibility → M03–M10
- [ ] P04 **Reliable (Offline)** — มีประสบการณ์ offline ตามขอบเขตที่ระบุ กลับมาออนไลน์แล้วลองใหม่ได้ และรับมือ request ล้มเหลวโดยไม่ทำงานที่กรอกหาย → W01, W04–W10, O01–O09
- [ ] P05 **Engaging (Notification) — deferred ตามคำสั่งผู้ใช้** → N01–N07 เก็บเกณฑ์ไว้เป็นอ้างอิง ไม่เพิ่ม permission prompt, subscription หรือการส่งเหตุการณ์ในรอบนี้
- [ ] P06 **Installable (จาก Browser)** — ติดตั้งหรือเพิ่มเข้า Home Screen/Dock ผ่านช่องทางที่ browser รองรับ แล้วเปิดและใช้งานได้จริง → I01–I08
- [ ] P07 **Secure** — ใช้ HTTPS และรักษาความปลอดภัยของข้อมูล การยืนยันตัวตน และขอบเขต seller → S01–S05, O07, N03, N05

คำว่า Native Mobile API ในภาพใช้เป็นชื่อหมวดความสามารถอุปกรณ์ที่เว็บเข้าถึงผ่าน Web APIs ไม่ได้หมายความว่าเว็บเข้าถึง hardware ได้ทุกชนิด การตรวจรับ P02 ต้องระบุรายการ API ที่เลือกใช้และผลทดสอบ ไม่ถือว่าการติดตั้ง PWA หรือ Workbox ทำให้หมวดนี้ผ่านเอง

สำหรับ P04 ให้รายงานระดับ offline ที่ผ่านด้วย: ปัจจุบันมี public fallback แต่ยังไม่ใช่การอ่าน/บันทึกข้อมูลธุรกิจออฟไลน์เต็มรูปแบบ ส่วน P05 ต้องทดสอบ push จริง ไม่ใช้ toast ภายในหน้าหรือการมี Service Worker แทนหลักฐาน Notification

## วิธีใช้และสถานะเริ่มต้น

ทุกช่องด้านล่างเป็น **เกณฑ์ตรวจรับ** จึงยังไม่ติ๊กเพียงเพราะพบโค้ด เมื่อผ่านให้ใส่หลักฐาน commit/build, browser/OS, ขั้นตอนและผลทดสอบ ข้อทางเลือกให้ระบุ N/A พร้อมเหตุผลเมื่อไม่อยู่ในขอบเขต ไม่ติ๊กว่า implementation เสร็จแทน N/A

| หมวด | สถานะที่พบจากโค้ด/การตรวจเดิม |
| --- | --- |
| Installable | มี manifest, icons, provider, install dialog และคำแนะนำ iOS |
| Worker/offline | Workbox, revisioned public fallback 5 assets; worker tests ผ่าน 7/7 |
| Workbox | 7.4.1 ผ่าน injectManifest + esbuild 0.28.1; ผู้ใช้อนุมัติแล้ว |
| HTTPS | มี secure-context guard/headers; deployment ยังไม่ได้ตรวจในงานนี้ |
| Capabilities | มีเลือกไฟล์, native share และ clipboard/manual fallback; Push deferred |
| Mobile/App Shell | มี responsive layout บางส่วน; offline เป็น fallback; ยังไม่ตรวจรับอุปกรณ์จริง/วัด performance |
| Store | ยังไม่ได้ทำ |

### ความคืบหน้าชุด implementation แรก — 11 กันยายน 2026

- เพิ่ม native share → clipboard → manual-copy dialog ใน quotation editor; ทดสอบ helper 6 กรณีผ่าน รวม cancellation ที่ไม่คัดลอกต่อ
- เพิ่มการดัก missing response ของการบันทึก/ลบใบเสนอราคาโดยไม่ replay; ทดสอบ 2 กรณีผ่าน ยังไม่ตรวจ transport failure ใน authenticated editor แบบ E2E
- เพิ่ม offline notice ใน admin shell, shared route error boundary และ admin loading feedback
- ปรับ install dialog สำหรับ Safari Mac/Firefox Windows/iOS และจำกัดความสูงให้เลื่อนได้
- Browser fixture ใช้คอมโพเนนต์จริง: offline/online เปลี่ยนสถานะ, retry เรียก callback, Escape คืน focus ไปปุ่มติดตั้ง; จอ 390px ไม่มี horizontal overflow; จอ 360×400 dialog สูง 368px และเลื่อนได้
- Fixture เป็นการจำลองสัญญาณเครือข่าย ไม่ใช่การทดสอบตัดเน็ตจริงหรืออุปกรณ์ Android/iOS; ข้อภาพรวมยังไม่ติ๊กผ่าน
- ผู้ใช้อนุมัติ Workbox แล้ว; Push deferred ทั้งหมวดตามข้อความล่าสุด ไม่รอเลือกเหตุการณ์
- ผลตรวจชุดนี้: typecheck ผ่าน, ESLint ผ่าน, production build ผ่าน และชุดทดสอบเต็ม 617/617 ผ่าน; independent code review ไม่พบประเด็นสำคัญ ข้อทดสอบเก่าที่บังคับให้เรียก clipboard โดยตรงถูกแทนที่ด้วย behavior tests ของ share helper โดยคง public-link access gate tests
- ยังไม่ได้ deploy, วัด performance ของ flow ที่ล็อกอิน, ติดตั้งบนอุปกรณ์จริง หรือทดสอบ Push delivery จึงยังไม่ผ่าน checklist ทั้งหมด

### ความคืบหน้า Workbox — 11 กันยายน 2026

- ใช้ Workbox 7.4.1 (`workbox-build`, `workbox-precaching`, `workbox-routing`, `workbox-strategies`) และ esbuild 0.28.1 เป็น devDependencies ที่ผู้ใช้อนุมัติ
- `npm run build:pwa` bundle runtime และ inject revision ของไฟล์สาธารณะ 5 ไฟล์; `npm run build` เรียกก่อน Next.js และ OpenNext ใช้ build script นี้
- Automated worker 7 กรณี + build reproducibility/revision-change 1 กรณีผ่าน; ชุดทดสอบเต็ม 620/620, typecheck, lint และ production build ผ่าน; independent review ไม่พบประเด็นที่ต้องแก้
- Browser จริง: Windows, Chromium 152.0.0.0 ใน Codex in-app browser, local production build ที่ `http://127.0.0.1:3137`; `/sw.js` activated และควบคุม scope `/`, Cache Storage มีเฉพาะ public allowlist 5 ไฟล์
- หยุด local server แล้วเปิด `/login`: แสดงหน้า offline ที่ URL เดิม; เปิด server กลับแล้วกด **ลองใหม่**: กลับหน้า login สำเร็จ เป็นการทดสอบ network failure จริงจาก server หยุด ไม่ใช่ตัดการเชื่อมต่ออุปกรณ์
- HTTP check ก่อน login: worker/manifest/assets ทั้ง 7 URL ได้ 200 และ MIME ถูกต้อง; worker มี `no-store, max-age=0` และ `Service-Worker-Allowed: /`
- ข้อจำกัดที่ยังต้องตรวจ: authenticated flows, หลายแท็บ/installed window, การอัปเดตจาก worker เดิมบนอุปกรณ์, performance ภายใต้เครือข่ายช้า, Android/iOS จริง และ HTTPS Staging
- รายการ audit 15 ข้อที่พบในรอบแรกแก้แล้วตามคำสั่งผู้ใช้: Next.js/ESLint config 16.3.4, Wrangler 4.131.0 และ transitive security fixes; audit ล่าสุดเหลือ 0 พร้อม CI gate ดู [บันทึก security remediation](security-dependencies-2026-09-11.md)

## Browser support ที่ใช้แทนข้อมูลปี 2023

### Update UX implementation และผลทดสอบ local — 11 กันยายน 2026

- เพิ่มข้อความมีเวอร์ชันใหม่ → อัปเดตตอนนี้/ภายหลัง → ยืนยันบันทึกงานก่อนโหลดใหม่; ใช้ Alert/Button/Dialog เดิมที่ root provider ครอบคลุมหน้า login และ admin
- เฉพาะหน้าต่างที่ยืนยันเท่านั้นที่สั่ง activation และ reload; หน้าต่างอื่นแจ้งโหลดรุ่นใหม่โดยไม่ reload อัตโนมัติ ทุกครั้งต้องยืนยันแม้ฟอร์มนั้นไม่มี dirty-state integration; beforeunload เดิมยังคงทำงาน
- รุ่นแอปเปลี่ยนจาก source/dependency fingerprint แบบ deterministic; ไม่อ่าน env/secrets และไม่ใช้เวลา build เป็น revision
- Worker เก่าที่ไม่รู้จัก activation message มี timeout และคำแนะนำให้บันทึกแล้วปิดทุกหน้าต่าง; UI ใหม่นี้ต้อง deploy และโหลดเข้าแท็บก่อนจึงใช้ได้กับการอัปเดตในอนาคต
- typecheck/lint/build ผ่าน, tests **626/626** ผ่าน รวม existing waiting worker, later install, first install, explicit activation, timeout และ release fingerprint
- Browser จริงใน Codex, localhost production build, สองแท็บ: กดภายหลังแล้วย้อนเปิดข้อความได้; ยืนยันอัปเดตแท็บแรกแล้ว reload สำเร็จ; อีกแท็บเก็บข้อความทดสอบที่กรอกไว้และแสดงโหลดเวอร์ชันใหม่ ไม่ reload
- หลัง activation หยุด local server แล้วกดลิงก์ `/login` → `/login?forgot=1`: Next.js แจ้ง RSC fetch ล้มเหลวและเปลี่ยนเป็น full navigation จากนั้น Workbox แสดงหน้าออฟไลน์ที่ URL ปลายทางได้ ไม่พบ browser error page ในกรณีนี้
- ผลนี้ไม่แทนการตรวจ Edge installed app ของผู้ใช้หรือ authenticated editor; ยังไม่ deploy ในงานนี้

### ตรวจเว็บที่ผู้ใช้ติดตั้งผ่าน Edge บน Windows — 11 กันยายน 2026

- ผู้ใช้ยืนยันว่าติดตั้งจาก `https://webook-admin.poolvilla.workers.dev/login` ผ่าน Edge; นี่เป็นหลักฐานการติดตั้งจากผู้ใช้ ยังไม่ใช่ผลตรวจ installed window โดย agent
- HTTPS `/login`, manifest, worker และ public offline assets ตอบ 200; manifest มี `display: standalone`, `id/start_url/scope: /` และไอคอน 192/512
- `/sw.js` บน origin นี้ตรงกับ generated worker ใน workspace รวม revision 5 รายการ ดังนั้นข้อสันนิษฐานก่อนหน้าว่าเว็บอาจยังใช้ worker เก่าไม่ตรงกับผลตรวจล่าสุด; การตรงกันของ worker ไม่ยืนยันเวอร์ชัน Next.js ที่ deploy
- Browser ที่เครื่องมือควบคุมได้เปิด login และนำทางไป forgot-password ได้ ไม่พบ console warn/error ใน flow นี้ และไม่ได้ส่งแบบฟอร์มหรือข้อมูลล็อกอิน
- HTTP probe `/admin/houses` โดยไม่มี session เปลี่ยนไป `/login` สำเร็จ
- พบ deployment configuration gap: `/sw.js` เสิร์ฟ `Cache-Control: public, must-revalidate, max-age=0` แทน `no-store, max-age=0` ใน Next config; `/pwa/*` เช่นกัน ไม่พบ `Service-Worker-Allowed` แต่ worker อยู่ที่ root จึงยังใช้ root scope ได้ตามตำแหน่งไฟล์ และ `text/javascript` เป็น JavaScript MIME ที่ใช้ได้
- ควรตั้ง header ของ static assets ผ่าน [Cloudflare `_headers`](https://developers.cloudflare.com/workers/static-assets/headers/) แล้วตรวจ response หลัง deploy; cache ที่ต้อง revalidate ปัจจุบันไม่ใช่หลักฐานว่าแอปติดตั้งหรือ offline ไม่ได้
- เครื่องมือไม่มี Edge/native-app surface จึงยังไม่ตรวจการเปิดจากไอคอน, standalone, offline/retry, multi-window และ authenticated flows ของแอปที่ผู้ใช้ติดตั้ง ไม่ได้ deploy หรือเปลี่ยนเว็บออนไลน์ระหว่างการตรวจนี้
- ผลจากผู้ใช้หลังลอง offline ใน Edge installed app: พบ **“Hmmm… can't reach this page”** แทนหน้า offline ของ WeBooks จัดเป็น failed สำหรับการทดสอบนี้ ยังไม่ทราบสถานะ worker/controller/cache หรือวิธี reload จึงยังไม่สรุปสาเหตุ และไม่ถือว่า header ที่ต่างเป็นสาเหตุโดยไม่มีหลักฐาน

ตารางนี้เป็นข้อมูลจากเอกสาร ไม่ใช่ผลทดสอบ WeBooks และไม่กำหนด minimum OS ของผลิตภัณฑ์โดยอัตโนมัติ ต้องบันทึกรุ่นที่ทดสอบจริงก่อน release

| Browser/OS | วิธีติดตั้งหรือเปิดเป็นแอป | แนวทาง UI ของ WeBooks |
| --- | --- | --- |
| Chrome/Edge บน desktop | รองรับติดตั้งผ่าน browser | ใช้ prompt เมื่อได้รับ beforeinstallprompt; มีคำแนะนำเมนูเมื่อไม่มี event |
| Chrome บน Android | รองรับติดตั้ง; WebAPK ขึ้นกับสภาพแวดล้อม เช่น GMS | ทดสอบทั้ง prompt และเปิดจากไอคอน |
| Samsung Internet | รองรับช่องทางติดตั้ง; WebAPK บนอุปกรณ์ Samsung | ทดสอบเครื่องจริง ไม่ถือว่าเหมือน Chrome ทุกขั้นตอน |
| Safari บน iPhone/iPad | Add to Home Screen | ใช้คำแนะนำเมนู Share; ไม่พึ่ง beforeinstallprompt |
| Browser อื่นบน iOS/iPadOS 16.4+ | สามารถมี Add to Home Screen ผ่าน Share menu | อย่าระบุว่า Safari เป็นช่องทางเดียว; ให้ Safari เป็นทางแนะนำได้ |
| Safari บน macOS Sonoma 14+ | Add to Dock | เพิ่มคำแนะนำสำหรับ Mac แยกจาก iPhone |
| Firefox บน Windows | Web apps ตั้งแต่ 143; รุ่น Microsoft Store ตั้งแต่ 150 | แนะนำปุ่ม web apps ของ Firefox; ไม่สมมติว่ามี Chromium install event |
| Firefox บน macOS/Linux | ฟีเจอร์ Windows web apps ยังไม่รองรับตามเอกสารที่ตรวจ | ใช้งานเว็บปกติได้และไม่แสดงคำแนะนำที่อ้างว่าติดตั้งแบบ Windows ได้ |
| In-app browser/private mode | ความสามารถและ storage อาจจำกัด | ให้เปิดใน browser หลักได้; เว็บต้องไม่พังเพราะติดตั้งไม่ได้ |

อ้างอิง: [MDN installability](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [Apple Safari web apps](https://support.apple.com/en-us/104996), [Mozilla Firefox web apps](https://support.mozilla.org/en-US/kb/web-apps-firefox-windows) ต้องแยก Firefox Windows web apps ออกจากการติดตั้งผ่าน manifest แบบ Chromium; ข้อความว่า Firefox ไม่รองรับ manifest installation ไม่ได้หมายความว่าไม่มีฟีเจอร์เปิดเว็บเป็นแอปบน Windows

| ความสามารถ | ข้อจำกัดที่ต้องออกแบบรองรับ |
| --- | --- |
| Service Worker/Cache | ตรวจ API และ secure context; storage อาจถูกล้าง; ต้องเคยโหลด assets สำเร็จก่อน offline |
| Web Push บน iOS/iPadOS | เริ่มจาก 16.4 สำหรับ Home Screen web app; ขอ permission หลังผู้ใช้กด; ต้องทดสอบ installed context |
| Web Share | รองรับไม่เท่ากัน; ตรวจ navigator.share และ canShare สำหรับ payload ที่เกี่ยวข้อง; ใช้ user gesture |
| Background Sync | ยังไม่รองรับทั่วทุก browser; ต้องมี foreground/manual fallback; Workbox ไม่ทำให้ API รองรับเท่ากัน |
| Camera/location/clipboard/อุปกรณ์ | ตรวจ API/permission ตามการใช้งานจริง; denied หรือ unsupported ต้องไม่ขวางงานพื้นฐาน |

อ้างอิง: [WebKit Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [MDN Web Share](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API), [MDN Background Sync](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API), [web.dev capabilities](https://web.dev/learn/pwa/capabilities)

## 0. สามแกนของ PWA — 04:36 และภาพรวม 06:15–08:38

- [ ] C01 Capable: งานหลักของ WeBooks ใช้ได้ และเพิ่มความสามารถอุปกรณ์พร้อม fallback
- [ ] C02 Reliable: ระบุสิ่งที่ทำได้เมื่อ offline/slow network และแสดงผลเมื่ออ่านหรือบันทึกล้มเหลวอย่างชัดเจน
- [ ] C03 Installable: ติดตั้งและเปิดจากไอคอนได้บนแพลตฟอร์มเป้าหมาย; browser ที่ติดตั้งไม่ได้ยังใช้เว็บได้
- [ ] C04 บันทึก browser/OS เป้าหมาย, เส้นทางหลัก และขอบเขต offline ที่ตกลงใช้เป็นเกณฑ์รับงาน

## 1. Add to Home Screen / Installable — 09:50

- [ ] I01 Manifest เสิร์ฟสำเร็จก่อน login มีชื่อ, id, start_url, scope, display และสีที่ถูกต้อง
- [ ] I02 ไอคอน 192/512 และ Apple icon โหลดได้ ขนาดถูก และดูเหมาะสมบน launcher จริง
- [ ] I03 ตรวจ artwork ก่อนเพิ่ม maskable; ของเดิมไม่มี maskable โดยตั้งใจตาม docs/pwa.md
- [ ] I04 ปุ่มติดตั้งใช้ event จริง รองรับยอมรับ/ยกเลิก/error และไม่ใช้ event ที่ถูก consume แล้วซ้ำ
- [ ] I05 คำแนะนำครอบคลุม Android, iOS, Safari Mac และ Firefox Windows ตามตารางปัจจุบัน
- [ ] I06 ซ่อน/ปรับเมนูเหมาะสมเมื่อ standalone หรือได้รับ appinstalled โดยไม่สมมติว่าตรวจการติดตั้งทุก browser ได้สมบูรณ์
- [ ] I07 เปิดจากไอคอน, deep link, login, session หมดอายุและ logout ได้จริง
- [ ] I08 Browser ที่ไม่ส่ง install event ยังมี fallback ใช้งานได้ และไม่มีการบังคับเปลี่ยน browser เพื่อใช้งานเว็บพื้นฐาน

## 2. Service Worker / Offline / Notification — 14:52

### Worker และ Workbox — สไลด์ 19–27

- [x] W01 ตรวจ local production build: /sw.js มี MIME, scope, cache headers และ registration ถูกต้อง — HTTPS deployment แยกที่ S01
- [x] W02 สรุปแพ็กเกจ/เวอร์ชันและ build integration สำหรับ Workbox injectManifest; อนุมัติ dependency ตาม AGENTS.md ก่อนติดตั้ง
- [x] W03 Bundle imports และ inject precache manifest สำเร็จ; build output ไม่มี unresolved npm imports หรือ runtime file ที่ขาด
- [x] W04 คง policy เดิม: cache เฉพาะ public allowlist; ไม่เก็บ admin HTML, RSC, API, private/signed URLs หรือ mutation — automated worker tests และ cache inspection ใน browser; account-switch E2E แยกที่ O07
- [x] W05 Navigation ใช้ NetworkOnly + offline fallback; HTTP error ยังคงเป็น response จาก server — automated + local browser network failure/retry
- [x] W06 ทดสอบ query matching และ revisioned cache lookup; URL ที่อยู่นอก allowlist ต้องไม่ถูกจับเข้า cache
- [ ] W07 อัปเดต assets แล้ว revision เปลี่ยน ถูกใช้ในรุ่นใหม่ และล้าง cache เก่าเฉพาะของแอป
- [ ] W08 คง /sw.js และ scope เดิมในการย้าย; ทดสอบจาก worker เดิมไป Workbox และการกู้คืนด้วย worker รุ่นแก้ไข
- [ ] W09 ไม่ force reload/skipWaiting อัตโนมัติขณะมีงานค้าง; ทดสอบหลายแท็บและ installed window
- [x] W10 ทดสอบ worker ที่ build แล้วทั้ง automated behavior และ browser integration — localhost Chromium 152; upgrade จาก worker เดิม/installed window ยังอยู่ W08–W09

injectManifest เป็นทางเลือกของ WeBooks เพื่อคง routing และ privacy policy; คลิปชี้ Workbox แต่ไม่ได้ยืนยันโหมดนี้ ดู [Workbox build modes](https://developer.chrome.com/docs/workbox/modules/workbox-build)

### Offline / Network / Storage

- [ ] O01 เปิดออนไลน์จน cache พร้อม แล้วตัดเน็ตเปิดแอป/รีโหลด พบหน้า offline ที่ใช้งานได้
- [ ] O02 ต่อเน็ตแล้วกด retry กลับ URL เดิมได้
- [ ] O03 กรณียังไม่เคย cache หรือ cache ถูกล้าง ถูกระบุข้อจำกัดและทดสอบโดยไม่อ้างว่า offline ใช้ได้เสมอ
- [ ] O04 เน็ตหลุดระหว่าง client navigation/RSC มีข้อความและวิธีลองใหม่; ไม่พึ่ง navigation fallback อย่างเดียว
- [ ] O05 บันทึกล้มเหลวไม่ทำค่าฟอร์มหาย ไม่แสดงสำเร็จลวง และไม่ replay mutation อัตโนมัติ
- [ ] O06 Slow network/timeout และ server error มี feedback แยกจาก offline; ไม่ใช้ navigator.onLine ยืนยันว่า server ติดต่อได้
- [ ] O07 ตรวจ Cache Storage หลังใช้ระบบ/logout/สลับผู้ใช้ ไม่พบข้อมูลส่วนตัวที่ worker เก็บ
- [ ] O08 ถ้าจะเพิ่ม IndexedDB/offline draft ให้กำหนดอายุข้อมูล การแยกผู้ใช้ การล้างข้อมูล และ conflict policy ก่อน implementation; ถ้าไม่ทำให้ระบุ N/A
- [ ] O09 Background Sync เป็นทางเลือก: หากใช้ต้องมี fallback, server idempotency และตรวจสิทธิ์ใหม่ก่อน sync; หากคง online-only ให้ระบุ N/A

### Push Notification — deferred ทั้ง N01–N07 ตามคำสั่งผู้ใช้

- [ ] N01 กำหนดเหตุการณ์ ผู้รับ ขอบเขต seller และเนื้อหาที่อนุญาตบน lock screen
- [ ] N02 UI opt-in/opt-out ตรวจ unsupported/default/granted/denied และขอ permission หลังผู้ใช้กด
- [ ] N03 Subscription ผูก user/seller ผ่าน server authorization และ RLS; keys อยู่ server เมื่อเป็นความลับ
- [ ] N04 ส่งและรับ push จริงเมื่อปิดหน้าเว็บบนแพลตฟอร์มเป้าหมาย; ทดสอบ iOS ใน Home Screen app
- [ ] N05 แตะแจ้งเตือนเปิดเส้นทางที่อนุญาตและตรวจสิทธิ์ใหม่; ไม่ส่งหรือเปิดข้อมูลข้าม seller
- [ ] N06 ทดสอบ unsubscribe, หมดอายุ, logout/สลับผู้ใช้, หลายอุปกรณ์และการส่งซ้ำ
- [ ] N07 กรณี browser ไม่รองรับหรือผู้ใช้ปฏิเสธยังทำงานหลักในเว็บได้

Push เป็นความสามารถในแนวทางคลิป แต่ไม่ใช่ข้อบังคับขั้นต่ำของการติดตั้ง หากเลื่อนออกจาก release นี้ต้องบันทึกว่า deferred ไม่ถือว่าทำครบหมวดแล้ว

## 3. HTTPS / Secure — 23:06

- [ ] S01 ตรวจ deployment เป้าหมาย: HTTPS certificate ถูกต้อง, redirect ที่เหมาะสม และไม่มี mixed content
- [ ] S02 Manifest/worker/assets ไม่ถูก login redirect หรือ response ผิดประเภท
- [ ] S03 CSP อนุญาตเฉพาะทรัพยากรที่ต้องใช้; ไม่มี client secrets หรือ privileged client
- [ ] S04 Server Actions ตรวจ input/auth และ services/repositories รักษาการแยก seller ตามสถาปัตยกรรมเดิม
- [ ] S05 หาก deploy ทดสอบ ใช้ Staging ผ่านคำสั่งที่กำหนดและตรวจ target ก่อน; build-script changes ต้องตรวจ reference ใน bundle ตาม AGENTS.md

## 4. Capabilities — 24:36

- [ ] A01 เลือกไฟล์/รูปจากมือถือได้ พร้อม validation และข้อความเมื่อไม่รองรับ/อัปโหลดล้มเหลว
- [ ] A02 แชร์ใบเสนอราคาด้วย native share เมื่อรองรับ; fallback เป็น clipboard และแสดงลิงก์คัดลอกเอง
- [ ] A03 ยกเลิก share sheet ไม่แสดงเป็น error และไม่ทำ action ต่อโดยผู้ใช้ไม่ได้สั่ง
- [ ] A04 การแชร์รักษาเงื่อนไขเอกสารบันทึกแล้ว/สิทธิ์เดิม; ไม่สร้างหรือขยาย public access โดยอัตโนมัติ
- [ ] A05 Clipboard failure มี fallback และไม่ทำให้หน้าใช้งานต่อไม่ได้
- [ ] A06 ประเมิน camera, microphone, location, Bluetooth, sensors และ Media Session ตาม use case; บันทึก N/A รายตัวที่ไม่จำเป็น
- [ ] A07 API ที่เลือกใช้ตรวจ support/permission และทดสอบ denied/unsupported; ไม่ใช้ชื่อ browser เป็นหลักประกันความสามารถ

## 5. Mobile Design / App-like UX — 29:39

- [ ] M01 วัด cold/warm launch และ interaction ของ login, บ้าน, รูป และใบเสนอราคาในเงื่อนไข mobile/slow network
- [ ] M02 กำหนด performance budget จาก baseline แล้วเปรียบเทียบก่อน/หลัง; ไม่ถือว่ามี Workbox แปลว่าเร็วแล้ว
- [ ] M03 ระบุ App Shell: ส่วนใดเป็น public UI ที่ offline ได้ และส่วนใดต้องออนไลน์; ไม่ cache authenticated HTML เพื่อทำ shell
- [ ] M04 Loading indicator/skeleton แสดงระหว่างรอและเปลี่ยนเป็น success/error ชัดเจน
- [ ] M05 Navigation และ interaction ตอบสนองทันที ไม่มี spinner ค้างโดยไม่มี recovery
- [ ] M06 ตรวจ 360/390/768px และ desktop; ไม่มี page overflow; ตารางกว้างเลื่อนในพื้นที่ของตัวเองได้
- [ ] M07 ตรวจ touch targets, sidebar, dialog, keyboard เปิด/ปิด, safe area, หมุนจอและปุ่มติดขอบใน standalone
- [ ] M08 ตรวจ keyboard navigation, focus, labels, screen reader status, contrast, zoom และ reduced motion
- [ ] M09 หน้า workspace บ้านที่แก้ไขรักษา House Workspace Shell ตาม spec; PWA UI ส่วนกลางใช้ shared components เดิม
- [ ] M10 ตรวจ Android/iOS จริงทั้ง browser และ installed app พร้อมบันทึกผล ไม่ใช้ desktop emulation แทนทั้งหมด

## 6. การลง Store — 33:48 (พักตามคำสั่งผู้ใช้)

สถานะ T01–T04: deferred ทั้งหมวด เก็บรายการไว้เป็นอ้างอิง ไม่ดำเนินการในรอบนี้

- [ ] T01 ระบุ Store/กลุ่มผู้ใช้ หรือบันทึก N/A หากแจกผ่านเว็บเท่านั้น
- [ ] T02 หากทำ: ตรวจวิธี package ปัจจุบัน, app identity/signing/domain association และข้อกำหนด Store ที่เลือก
- [ ] T03 เตรียม metadata, artwork/screenshots, privacy/support และทดสอบแพ็กเกจจริง
- [ ] T04 แยกสถานะ prepared/submitted/approved/published; ไม่อ้างว่าเผยแพร่แล้วเพียงเพราะ package สำเร็จ

## เกณฑ์ปิดงานและหลักฐาน

- [ ] D01 ข้อในขอบเขตมีผลทดสอบผ่าน; N/A/deferred มีเหตุผลชัดเจนและรายการงานคงค้าง
- [ ] D02 หลังแก้โค้ด: typecheck, lint, relevant/full tests และ build ผ่าน พร้อม code review
- [ ] D03 เอกสารติดตั้ง/offline/cache/update/browser support ตรงกับพฤติกรรมสุดท้าย
- [ ] D04 บันทึก commit/build, environment, device/OS/browser version, วันที่ และผลของแต่ละ test case

| ID | Commit/build + environment | OS/browser/device | ขั้นตอนและผล/หลักฐาน | สถานะ + ผู้ตรวจ/วันที่ |
| --- | --- | --- | --- | --- |
| ตัวอย่าง I07 | รอทดสอบ | รอระบุ | ติดตั้ง → เปิดจากไอคอน → login → logout | ยังไม่ตรวจรับ |

รอบจัดทำ checklist นี้แก้เอกสารเท่านั้น ไม่รัน build/typecheck/tests ใหม่ และไม่ได้ติดตั้ง dependency หรือ deploy
