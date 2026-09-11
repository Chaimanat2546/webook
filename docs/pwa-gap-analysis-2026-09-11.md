# วิเคราะห์ PWA ของ WeBooks: บทสนทนา คลิปต้นฉบับ และ Workbox

วันที่ตรวจ: 11 กันยายน 2026

หมายเหตุหลัง implementation: รายงานด้านล่างเก็บสภาพก่อนเปลี่ยนแปลงไว้เป็นเหตุผลประกอบ ปัจจุบันติดตั้ง Workbox 7.4.1 แล้วตามการอนุมัติของผู้ใช้ และพัก Push Notification กับ Store; ดูสถานะและหลักฐานล่าสุดใน checklist

รายการตรวจรับแยกตามหัวข้อคลิปและตาราง browser support ที่ปรับล่าสุดอยู่ใน [PWA checklist](pwa-checklist.md) ใช้ไฟล์นั้นติดตามผล implementation/ทดสอบ โดยรายงานนี้เก็บเหตุผลและการวิเคราะห์สถาปัตยกรรม

## ขอบเขตและข้อสรุป

ตรวจบทสนทนา [สรุปคลิป PWA](https://chatgpt.com/share/6aa388d7-9d38-83ec-a820-a995ee2a8160) เทียบกับโค้ดปัจจุบัน เอกสารโปรเจกต์ และเอกสารทางการ ต่อมาเพิ่มการตรวจ [คลิปต้นฉบับของ mikelopster](https://www.youtube.com/watch?v=PgLCP3YNB_8) ซึ่งหน้า YouTube ระบุวันที่เผยแพร่ 30 ตุลาคม 2023 และอ่านเนื้อหาข้อความจาก [สไลด์ประกอบทั้ง 50 หน้า](https://docs.google.com/presentation/d/18lzCrVsPpznEpnPlunm6IdfJRoCeRSc8xpEWBzWWcfs/edit) ผ่านมุมมอง HTML ของ Google Slides

ยืนยันเวลา chapter จากคำอธิบายของผู้เผยแพร่ได้แล้ว แต่ยังไม่ได้ transcript: เครื่องมือ export ไม่ได้คำบรรยาย และแผง Transcript บน YouTube ค้างที่ loading จึงไม่อ้างว่าได้ฟังหรือถอดคำพูดครบทั้งคลิป ภาพที่ฝังในสไลด์ไม่ได้ถูกถอดข้อความครบทุกภาพ ข้อสรุปด้าน Workbox อ้างจากข้อความที่อ่านได้โดยตรงและตรวจประกอบเอกสารทางการ

WeBooks มีฐาน PWA แล้ว: manifest, ไอคอน, standalone, วิธีติดตั้ง, Service Worker และหน้าออฟไลน์ แต่ยังไม่ควรประกาศว่าประสบการณ์ PWA ครบทุกด้าน เพราะยังต้องตรวจการใช้งานจริงบนมือถือ เครือข่ายที่ล้มเหลวระหว่างใช้แอป และการติดตั้งบนระบบปฏิบัติการจริง ส่วน Push ยังไม่มี implementation

รายงานนี้ไม่ได้เปลี่ยนพฤติกรรมแอป ติดตั้ง dependency หรือ deploy รายการงานด้านล่างเป็นข้อเสนอเพื่อดำเนินการต่อ ไม่ใช่ผลการติดตั้งฟีเจอร์แล้ว

## สิ่งที่เพิ่มจากการตรวจแหล่งต้นฉบับ

รายงานครั้งแรกขาดการประเมิน Workbox และให้น้ำหนักเรื่อง App Shell/ความเร็วไม่เพียงพอ สไลด์ผู้สอนยืนยันว่าทั้งสองเรื่องเป็นส่วนหนึ่งของแนวทางที่ควรพิจารณา การยึดแนวทางคลิปจึงต้องรวมคุณภาพการโหลดและการบำรุงรักษา worker ด้วย

| ตำแหน่งในแหล่งต้นฉบับ | ประเด็น | การนำมารวมกับ WeBooks |
| --- | --- | --- |
| 04:36; สไลด์ 4 | สามแกนของ PWA | ใช้เป็นกรอบตรวจรับความสามารถ ความน่าเชื่อถือ และการติดตั้ง |
| 09:50; สไลด์ 12–18 | ติดตั้งและ manifest | รักษาของเดิม และทดสอบ browser/OS จริง |
| 14:52; สไลด์ 19–27 | Worker, cache, offline, push และ Workbox | เพิ่มการตัดสินใจเลือกเครื่องมือ พร้อม policy cache รายประเภท |
| สไลด์ 25 | “Service Worker = Workbox” | ผู้สอนยก Workbox เป็นแนวทางใช้งาน; ทางเทคนิค Workbox คือ library ที่ทำงานบน Service Worker APIs |
| 23:06; สไลด์ 28–30 | ความปลอดภัยของการเชื่อมต่อ | ตรวจ HTTPS จริง และรักษา server authorization |
| 24:36; สไลด์ 31–38 | Device APIs และตรวจ browser support | เน้น share/files ที่สัมพันธ์กับงาน พร้อม fallback |
| 29:39; สไลด์ 39–43 | App Shell, ความเร็ว, feedback และ accessibility | เพิ่มงานวัด performance และ loading/error states; ตรวจ offline shell ที่ไม่บรรจุข้อมูลส่วนตัว |
| 33:48; สไลด์ 49 | ช่องทาง Store | เก็บเป็นงานเผยแพร่ที่มีเกณฑ์รับงานแยก |

ตำแหน่งและหัวข้ออ้างจาก [คำอธิบายคลิป](https://www.youtube.com/watch?v=PgLCP3YNB_8) และ [สไลด์ของผู้สอน](https://docs.google.com/presentation/d/18lzCrVsPpznEpnPlunm6IdfJRoCeRSc8xpEWBzWWcfs/edit) ตารางนี้เป็นการประยุกต์กับโปรเจกต์ ไม่ใช่คำสั่ง implementation ของผู้สอน

คลิปเป็นแนวทางอ้างอิงที่ดี แต่ข้อมูล browser support ในสไลด์เป็นบริบทปี 2023 ต้องตรวจเอกสารปัจจุบันก่อนใช้ ตัวอย่างเช่น Safari บน macOS รองรับ Add to Dock ตั้งแต่ Sonoma/Safari 17 ตาม [MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) จึงไม่ควรคัดลอกตาราง compatibility เก่ามาเป็นข้อจำกัดปัจจุบัน

## Workbox: ข้อเสนอสำหรับทิศทางถัดไป

สถานะจริงยังเป็น custom Service Worker ใน `public/sw.js`; การค้น `package.json`, `package-lock.json` และ `next.config.ts` ไม่พบ Workbox, next-pwa หรือ Serwist

**ข้อเสนอ:** ถ้าขยายตามแนวทางนี้ให้ใช้ Workbox แบบ `injectManifest` เป็นตัวเลือกหลักสำหรับ worker รุ่นถัดไป เหมาะกับ policy เฉพาะของ WeBooks และแผนเพิ่ม push ส่วน worker เดิมยังเหมาะกับขอบเขต fallback เล็ก ๆ ปัจจุบัน การไม่มี Workbox จึงไม่ใช่ bug แต่การขยายระบบทำให้ประโยชน์ของ tooling มีน้ำหนักมากขึ้น

| ทางเลือก | ประโยชน์ | ข้อแลกเปลี่ยน/ข้อสรุป |
| --- | --- | --- |
| Custom worker เดิม | เล็ก ไม่มี dependency เข้าใจ policy ได้ง่าย | ต้องดูแล revision, routing, cleanup และ lifecycle เอง; เหมาะถ้าคงเพียง fallback |
| Workbox generateSW | สร้าง worker จาก configuration | เหมาะงานทั่วไปที่ต้องปรับแต่งไม่มาก; ไม่ใช่ตัวเลือกหลักเมื่อมี logic เฉพาะและ push |
| Workbox injectManifest | ควบคุม worker เองและให้ build เติมรายการ precache/revision | แนะนำสำหรับทิศทางขยายนี้; ต้องเพิ่ม build integration และทดสอบผลลัพธ์ที่ deploy จริง |

Workbox ช่วยจัดการ routing, caching และ revision ของ assets แต่ไม่ได้สร้าง mobile UX, authorization หรือระบบส่ง push ทั้งชุดให้เอง ดู [Workbox overview](https://web.dev/learn/pwa/workbox) และ [การเลือก generateSW/injectManifest](https://developer.chrome.com/docs/workbox/modules/workbox-build) ข้อเสนอเลือก injectManifest เป็นข้อวิเคราะห์จากสถาปัตยกรรมของเรา ไม่ใช่การยืนยันว่าคลิปกำหนดโหมดนี้

โมดูลที่เสนอให้ประเมินก่อนติดตั้ง: `workbox-build`, `workbox-precaching`, `workbox-routing`, `workbox-strategies`; `workbox-window` เป็นตัวเลือกสำหรับสื่อสาร lifecycle และ `workbox-expiration` ใช้เมื่อมี runtime cache ที่ต้องจำกัดขนาดจริง ไม่จำเป็นต้องเพิ่มทุกโมดูล

### นโยบาย request ที่ต้องคงไว้เมื่อย้าย

| Request/asset | กลยุทธ์ที่เสนอ | เหตุผลใน WeBooks |
| --- | --- | --- |
| offline HTML/JS และไอคอน allowlist | Revisioned precache | ใช้ offline ได้และเปลี่ยนรุ่นตามเนื้อหา |
| Full-page navigation | NetworkOnly แล้วคืน public offline fallback เมื่อ network ล้มเหลว | ไม่บันทึก HTML ที่มีข้อมูลผู้ใช้; คง HTTP 401/403/404/500 ตาม server |
| RSC, API, Server Actions, uploads, POST | Bypass worker cache | คงความสดและไม่ replay การบันทึก |
| รูปส่วนตัว, signed URL, ใบเสนอราคา | ไม่เพิ่ม runtime cache | ต้องรักษาสิทธิ์และการเพิกถอนการเข้าถึง |
| public static assets เพิ่มเติม | พิจารณาหลังวัดผล และอนุมัติ allowlist | หลีกเลี่ยงขยาย cache โดยไม่ได้ประโยชน์ที่วัดได้ |

คำว่า **NetworkOnly + fallback** ต่างจาก `NetworkFirst`: NetworkFirst สามารถเก็บ response สำเร็จไว้ใน cache จึงไม่ควรใช้กับ admin HTML ภายใต้ข้อจำกัดนี้ `StaleWhileRevalidate` ก็ไม่ควรครอบ API สิทธิ์ ราคา หรือข้อมูลลูกค้าแบบกว้าง ๆ ดูพฤติกรรมของ [Workbox strategies](https://developer.chrome.com/docs/workbox/modules/workbox-strategies)

ข้อกำหนด migration ที่ต้องทดสอบ:

- คง `/sw.js` และ scope เดิม; bundle runtime ที่จำเป็นให้เสิร์ฟจาก origin เดียวกันตาม CSP เดิม
- `workbox-build.injectManifest` เติมรายการ assets แต่ไม่ได้ bundle npm imports ให้เอง ต้องกำหนด bundling step หรือใช้ integration ที่ทำครบก่อน deploy
- ไม่ glob ทั้ง `public`, `.next` หรือ output ฝั่ง server; เริ่มเฉพาะ 5 offline assets เดิม
- ควบคุมการจับคู่ query ให้เทียบเท่า policy เดิม ไม่ให้ precache matcher ตัด query บางตัวแล้วเข้าถึง cache โดยไม่ได้ตั้งใจ; ตรวจค่า `ignoreURLParametersMatching`, URL aliases และเงื่อนไข `url.search` ใน matcher
- การคืน fallback ใช้การ lookup ตาม precache revision ของ Workbox เช่น `matchPrecache` ไม่สมมติว่า key ภายในเป็น URL เปล่าเสมอ ดู [workbox-precaching](https://developer.chrome.com/docs/workbox/modules/workbox-precaching)
- ลบ legacy `webook-offline-*` หลัง worker ใหม่ติดตั้งสำเร็จและ activate; ห้ามลบ cache อื่นร่วม origin
- ไม่เปิด skipWaiting/force reload อัตโนมัติ ถ้าจะมีปุ่มอัปเดตต้องคำนึงถึง dirty form ในทุกแท็บ ไม่ใช่เฉพาะแท็บที่กด
- ตรวจ worker ที่ build แล้วจริง: npm imports ต้อง resolve, runtime chunks มีครบ, precache URL ไม่มี private artifacts และ app รุ่นเก่ายังอยู่ได้ระหว่างรอ activation
- รันทดสอบ policy เดิมกับ worker output ใหม่และ browser integration; VM fixture เดิมอาจต้องปรับเพื่อรองรับ Workbox จึงใช้ผล tests เดิมแทนผล migration ไม่ได้

Workbox ไม่ต้องรันเป็น Cloudflare server Worker เพราะนี่เป็น worker ใน browser แต่ build pipeline ต้องส่งไฟล์ที่ถูกต้องไปกับ OpenNext deployment ทดสอบ local production build และ Staging ก่อนสรุป compatibility อย่าถือว่าเพิ่ม dependency แล้วเสร็จ

ยังไม่มีการเลือกเวอร์ชันหรือติดตั้ง dependency; ต้องตรวจ runtime/build และเสนอรายการแพ็กเกจตามกติกา AGENTS.md ก่อน implementation

## App Shell และ performance ที่เพิ่มจากคลิป

ปัจจุบัน precache เฉพาะหน้า offline หมายความว่าเปิดข้อความออฟไลน์ได้ ไม่ใช่การเปิดหน้า admin ทั้งระบบโดยไม่ใช้เน็ต การเปลี่ยนมา Workbox อย่างเดียวก็ไม่เปลี่ยนข้อจำกัดนี้

แนวทางที่แนะนำ:

1. วัด cold/warm launch และ interaction ของ login, รายการบ้าน, รูป และ quotation editor ภายใต้ mobile/slow network ก่อนปรับ cache
2. ตรวจ loading indicator/skeleton และ feedback หลังแตะปุ่มบนเส้นทางหลัก ลดการรอที่ไม่รู้ว่าระบบกำลังทำงาน
3. เสริม public offline shell ได้ด้วย UI ทั่วไปที่ไม่มี user/seller/customer state; เมนูที่ต้องใช้ server ต้องบอกสถานะชัดเจน ห้ามเก็บ admin HTML มาทำ shell
4. ตรวจ route loading/error ใน App Router แยกจาก Service Worker เพราะ cached JavaScript/CSS ไม่ทำให้ RSC และ Server Actions ใช้งาน offline เอง
5. หากผลวัดชี้ว่าคุ้มจึงพิจารณา hashed static assets โดยทดสอบ deployment รุ่นเก่า/ใหม่และ storage budget; ไม่ขยาย allowlist ทันที
6. รักษา accessibility: keyboard, focus, semantics, การแจ้งสถานะ และ reduced motion รวมถึง safe area/virtual keyboard ใน standalone

[PWA checklist ของ web.dev](https://web.dev/articles/pwa-checklist) ให้ความสำคัญกับความเร็ว การรองรับ browser/input และประสบการณ์ผู้ใช้; [คำแนะนำ precaching](https://developer.chrome.com/docs/workbox/precaching-dos-and-donts) ช่วยกำหนดว่าควรเก็บทรัพยากรใด ส่วนรายละเอียดข้างต้นเป็นข้อเสนอเฉพาะของ WeBooks

เกณฑ์รับงานเพิ่ม: มีผลวัดก่อน/หลังในเงื่อนไขเดียวกัน ไม่มี regression ของ flow หลัก และ app ตอบสนองพร้อมบอกสถานะเมื่อ offline/slow network ใช้ accessibility และ functional checks ร่วมด้วย ไม่ใช้คะแนน Lighthouse เพียงอย่างเดียวเป็นคำรับรองว่า PWA ครบ

## นิยามคำว่า “ครบ”

- **ฐาน PWA:** ติดตั้งและเปิดได้ มีประสบการณ์เมื่อเครือข่ายขัดข้อง ทำงานผ่าน HTTPS และใช้บนมือถือได้
- **ความสามารถที่มีประโยชน์กับ WeBooks:** แชร์ใบเสนอราคา เลือกไฟล์/รูป และแจ้งเตือนเหตุการณ์ธุรกิจที่กำหนดชัดเจน
- **ทางเลือกเพิ่มเติม:** ทำงานและบันทึกข้อมูลออฟไลน์เต็มรูปแบบ, กล้องแบบ live, location, microphone, hardware และการลง Store ต้องมี use case จึงค่อยทำ

Service Worker ไม่ใช่ข้อบังคับสำหรับการติดตั้งในทุกกรณี และ Push ไม่ใช่เกณฑ์ติดตั้งขั้นต่ำ อย่าใช้จำนวน Web APIs เป็นตัวชี้วัดความครบของ PWA ดู [เกณฑ์ติดตั้งของ MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) การเพิ่ม API ควรตรวจความสามารถก่อนใช้และมี fallback ตาม [แนวทาง capabilities ของ web.dev](https://web.dev/learn/pwa/capabilities)

## ตารางเทียบทุกหัวข้อ

| หัวข้อ | หลักฐานในโปรเจกต์ | สถานะและสิ่งที่ต้องทำต่อ |
| --- | --- | --- |
| เว็บเดิม/codebase เดียว | Next.js App Router เดิม; root PwaProvider | มีแล้ว ไม่ต้องสร้าง Native App ใหม่ |
| Manifest | `app/manifest.ts`: id, name, short_name, lang, start_url, scope, display, สี และ icons | มีค่าพื้นฐาน ตรวจ response จริง `/manifest.webmanifest` และการเข้าถึงก่อน login |
| ไอคอน/standalone | PNG 192/512, Apple icon; metadata ใน `app/layout.tsx` | มีแล้ว ตรวจ launcher และการเปิดจริง Android/iOS; ไม่มี maskable โดยตั้งใจตามข้อจำกัด artwork ใน `docs/pwa.md` |
| Install UI | `components/pwa/install-app-menu-item.tsx`, sidebar | มี prompt, manual fallback, iOS instructions, error handling; ตรวจบน authenticated mobile sidebar จริง |
| Install lifecycle | `components/pwa/pwa-provider.tsx` | จับ beforeinstallprompt/appinstalled, consume event, ซ่อนเมื่อ standalone; การไม่มี event ไม่ได้แปลว่าติดตั้งไม่ได้ |
| Service Worker | `public/sw.js` และ provider | มี install/activate/fetch; register เฉพาะ production build + secure context |
| Cache/ความเร็ว | precache เฉพาะ offline assets 5 URL | ช่วยหน้า fallback/ไอคอน ยังไม่ใช่ caching ของหน้าแอปทั้งหมด; ยังไม่ได้วัด performance |
| Offline เปิดหน้า/เปิดแอป | `public/pwa/offline.html`, `offline.js` | มีหน้าไทยและ retry URL เดิม หลังเคยเปิดออนไลน์ให้ cache สำเร็จ |
| Offline ภายในแอป | RSC, API, mutations เป็น network-only | fallback ของ worker ไม่ครอบคลุม client navigation/form; ต้องตรวจและปรับประสบการณ์ error/retry |
| ข้อมูลส่วนตัว | worker ไม่ cache admin HTML, ใบเสนอราคา, API, RSC หรือ external requests | เหมาะกับข้อจำกัดปัจจุบัน; ทดสอบ cache หลัง logout/สลับผู้ใช้อีกครั้งใน browser; ไม่ใช่การรับรอง cache ทุกชั้นของระบบ |
| Update | versioned cache, ลบเฉพาะ prefix, ไม่มี skipWaiting | มีวิธีรอปิดทุกหน้าต่าง; ทดสอบหลายแท็บกับงานที่ยังไม่บันทึก; update UI เป็น enhancement |
| HTTPS | secure-context guard, worker headers, CSP | โค้ดรองรับ แต่ยังไม่ตรวจ certificate, redirect, mixed content และ headers บน deployment ในรอบนี้ |
| Push Notification | ไม่พบ subscription/VAPID/push/notificationclick ในส่วนที่ค้น | ยังไม่มี ถ้าต้องการส่วนนี้ต้องเพิ่มครบทั้ง client/server/storage และกำหนดเหตุการณ์/ผู้รับ |
| Clipboard | quotation editor และ user manager | มีแล้ว; quotation แสดง error หากคัดลอกไม่ได้ ควรมีลิงก์ให้เลือกคัดลอกเองเป็น fallback |
| Share ไปแอปอื่น | `shareSaved()` ปัจจุบันคัดลอกลิงก์ | ไม่พบ navigator.share; เสนอ native share พร้อม fallback สำหรับใบเสนอราคาที่บันทึกและแชร์ได้อยู่แล้ว |
| Files/รูป | file input ใน image-zone-viewer | มีแล้ว ไม่จำเป็นต้องเพิ่ม File System Access API เพื่อถือว่าครบ; ตรวจเลือกไฟล์จริงบนมือถือ |
| Camera/location/mic/hardware | ไม่พบการเรียก APIs เหล่านี้จากการค้น | ตัวอย่าง capability ไม่ใช่ฟีเจอร์บังคับของธุรกิจ; การเปิดกล้องจาก file picker ขึ้นกับอุปกรณ์และต้องทดสอบ |
| Mobile Design | Sidebar ใช้ Sheet บนมือถือ, responsive layout, dvh บางหน้า, safe-area ของ quotation actions | มีพื้นฐาน แต่ยังไม่มีผลตรวจครบเส้นทางหลักบนอุปกรณ์จริงในรอบนี้ |
| Store | ไม่พบแพ็กเกจสำหรับ Store ในขอบเขตที่ตรวจ | เป็นช่องทางเผยแพร่แยก ไม่ขวางการติดตั้งผ่านเว็บ |

## ลำดับงานที่แนะนำ

### 1. ปิดช่องว่างความน่าเชื่อถือก่อน

ทดสอบ login → รายการบ้าน → workspace บ้าน/รูป → ใบเสนอราคา โดยตัดเครือข่ายทั้งก่อนเปิดหน้า ระหว่างเปลี่ยนหน้า และระหว่างบันทึก

- ให้เห็นสถานะการเชื่อมต่อเมื่อเน็ตหลุด และข้อความเฉพาะเมื่อ request ล้มเหลว; `navigator.onLine` เป็นเพียงสัญญาณ ไม่ยืนยันว่า server ติดต่อได้
- ให้ retry เฉพาะการอ่านเมื่อผู้ใช้ร้องขอ ไม่ retry การบันทึกอัตโนมัติ เพราะ server อาจบันทึกสำเร็จแล้วแต่ response หาย
- รักษาค่าฟอร์มในหน้าปัจจุบันเมื่อบันทึกล้มเหลว ไม่ reload/เปลี่ยนหน้าจนทำให้งานหาย
- จัดการ client navigation/RSC error อย่างชัดเจน; พิจารณา route error boundary พร้อม retry โดยระวัง reset ที่ทำให้ state ของฟอร์มหาย
- ตรวจ slow network, timeout และ HTTP error แยกจาก offline; worker ปัจจุบันรอ fetch จึงยังไม่ได้รับประกันเวลารอสูงสุด
- คง policy cache เฉพาะ public fallback; การเก็บ draft ใน IndexedDB หรือทำ sync queue เป็นงานออกแบบข้อมูลแยก

พื้นที่แก้ที่คาดหมาย: `components/pwa/`, `components/layout/admin-shell.tsx`, error boundary ที่เหมาะกับ route และ form handlers ที่พบปัญหาจากการทดสอบ ใช้ `components/ui/alert.tsx`, Button และ Sonner ที่มีอยู่ก่อนสร้าง primitive ใหม่

เกณฑ์รับงาน: ผู้ใช้รู้ว่างานบันทึกสำเร็จหรือยัง ไม่มีข้อความสำเร็จลวง ไม่มีการส่งซ้ำอัตโนมัติ และ retry อ่านข้อมูลได้โดยไม่ทำงานที่กำลังกรอกหายโดยไม่เตือน

### 2. ตรวจและเก็บรายละเอียด Mobile/Standalone

ตรวจขนาด 360, 390, 768 และ desktop เป็นชุดเริ่มต้น พร้อมอุปกรณ์ Android/iOS จริง

- หน้าไม่ล้นแนวนอน; ตารางกว้างเลื่อนได้ในพื้นที่ของตัวเอง
- Sidebar, Dialog, ปุ่มติดตั้ง, ปุ่มบันทึกและแชร์ใช้ได้ด้วย touch และ keyboard
- เปิดคีย์บอร์ดแล้วเห็นช่องกรอก/ปุ่มสำคัญ เลื่อนถึงได้; ตรวจ safe area, หมุนจอ และแถบระบบ
- ตรวจ focus, label, ข้อความ error และการ zoom
- ตรวจติดตั้ง เปิดจากไอคอน session หมดอายุ login/logout และ deep link
- ตรวจ update ขณะมีหลายแท็บและฟอร์มยังไม่บันทึก; ปิดทุกหน้าต่างแล้วเปิดใหม่รับรุ่นใหม่ได้

ใช้ Sidebar/Sheet/Dialog เดิม การปรับส่วนกลางของ PWA ไม่ใช่ workspace บ้านจึงไม่ใช้ House Workspace Shell แต่ถ้าแก้หน้า `app/admin/houses/[propertyId]/...` ต้องอ่านและรักษา shell ตามข้อกำหนดโปรเจกต์

เกณฑ์รับงาน: บันทึก browser/OS, viewport, ขั้นตอน, ผล และหลักฐานของแต่ละ flow ไม่ใช้ responsive classes ใน source เป็นหลักฐานว่าผ่านแล้ว

### 3. เพิ่ม capability ที่ใช้งานจริง: แชร์ใบเสนอราคา

ใช้เมนูเดิมใน quotation editor เป็นจุดเข้า ไม่ต้องสร้างระบบแชร์ใหม่

- ใช้ Web Share เมื่อรองรับและผู้ใช้กดเอง โดยแชร์เฉพาะ public URL ที่ผ่านเงื่อนไขเดิม
- ถ้าไม่รองรับให้คัดลอกลิงก์ ถ้า clipboard ใช้ไม่ได้ให้แสดงลิงก์เพื่อคัดลอกเอง
- การยกเลิก share sheet ไม่ใช่ข้อผิดพลาด และต้องไม่แอบคัดลอกลิงก์ต่อเมื่อผู้ใช้ยกเลิก
- ห้ามสร้าง public token หรือขยายสิทธิ์เอกสารเป็นผลข้างเคียงของการเพิ่ม native share

เกณฑ์รับงาน: supported, unsupported, cancellation และ permission/error paths ใช้ได้ พร้อมรักษาข้อจำกัดเอกสารที่ยังไม่บันทึก/ยังแชร์ไม่ได้

### 4. Push Notification หากต้องการทำความสามารถนี้ด้วย

ก่อน implementation ต้องระบุเหตุการณ์ ผู้รับ tenant/seller และข้อความที่แสดง เช่นการแจ้งเตือนงานที่ต้องดำเนินการ ตัวอย่างนี้เป็นข้อเสนอ ไม่ใช่ requirement ที่ยืนยันจากบทสนทนา

โครงสร้างที่ต้องมี:

1. UI เปิด/ปิดการแจ้งเตือน ตรวจ support และสถานะ permission ขอสิทธิ์หลังผู้ใช้กดเท่านั้น
2. Server Action ตรวจ auth/input แล้วเรียก service เพื่อ subscribe/unsubscribe
3. Migration ใหม่เก็บ subscription ผูก user กับขอบเขต seller ที่ระบบใช้จริง พร้อม RLS; repository รับผิดชอบเฉพาะฐานข้อมูล
4. Server integration ส่ง Web Push โดย private key อยู่ server เท่านั้น; ตรวจ endpoint เพื่อป้องกัน SSRF ไม่เชื่อ URL ที่ client ส่งมาโดยตรง
5. Service Worker รับ push และ notificationclick; ตรวจ payload จำกัดปลายทาง navigation เป็นเส้นทางที่อนุญาต และตรวจสิทธิ์อีกครั้งเมื่อเปิด
6. จัดการ subscription หมดอายุ 404/410, การถอน permission, logout/สลับบัญชี, หลายอุปกรณ์ และการส่งซ้ำ
7. ไม่แสดงข้อมูลลูกค้า/รายละเอียดอ่อนไหวบน lock screen โดยปริยาย; endpoint และ subscription keys ไม่ควรอยู่ใน log

บน iOS/iPadOS การรองรับ Web Push สำหรับ Home Screen web app เริ่มจาก 16.4 และการขอ permission ต้องเป็นผลจากการโต้ตอบของผู้ใช้ ตาม [WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) จึงต้องทดสอบกรณีติดตั้งแล้วด้วย รายละเอียด subscription/event ดู [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)

เกณฑ์รับงาน: opt-in/opt-out จริง รับเมื่อปิดหน้าเว็บได้บนแพลตฟอร์มรองรับ เปิดหน้าที่ถูกต้อง ไม่ส่งข้าม seller/ผู้ใช้ และกรณีไม่รองรับยังใช้งานเว็บปกติได้ ไม่รับประกันการส่งทันทีทุกครั้งเพราะขึ้นกับ OS/network

หากต้องเพิ่ม library ส่ง Web Push ต้องเสนอ dependency และขออนุมัติตาม AGENTS.md ก่อนติดตั้ง ไม่ควรเลือก library จนตรวจ runtime ที่จะใช้งานจริง

### 5. Store เป็นระยะเผยแพร่แยก

เลือก Store และกลุ่มผู้ใช้ก่อน จากนั้นตรวจขั้นตอนปัจจุบันของแพลตฟอร์มนั้น: package, application identity, signing, domain association ถ้าจำเป็น, บัญชีนักพัฒนา, screenshots, privacy/support และกระบวนการตรวจรับ

Android อาจใช้ TWA/Bubblewrap ส่วน Store อื่นมีขั้นตอนเฉพาะ ดู [แนวทาง installation ของ web.dev](https://web.dev/learn/pwa/installation) การเพิ่ม manifest ไม่เท่ากับส่งขึ้น Store สำเร็จ และรายงานนี้ไม่ได้รับรองว่าจะผ่านการตรวจของ Store

## สิ่งที่ต้องรักษาในสถาปัตยกรรม

- UI → Server Actions → services → repositories/integrations; client ไม่เข้าถึง privileged clients หรือ secrets
- ตัวตน PWA และ cache แยกตาม origin อยู่แล้ว แต่ไม่ทดแทน seller authorization; manifest ปัจจุบันเป็นแบรนด์ WeBooks เดียว หากจะให้แต่ละ seller มีแบรนด์เฉพาะต้องกำหนด requirement เพิ่ม
- ไม่ cache ข้อมูลลูกค้า/ใบเสนอราคาเพื่อทำให้ checklist ดูครบ
- เพิ่ม schema ผ่าน migration ใหม่เท่านั้น
- ใช้ component ที่มีอยู่ก่อน โดยเสนอทางเลือก UI ก่อน implementation ตามกติกาโปรเจกต์
- ทดสอบ local production build ก่อน เพราะ `npm run dev` ไม่ register worker
- หากต้อง deploy เพื่อทดสอบ ให้ใช้ Staging และคำสั่งที่โปรเจกต์กำหนด ตรวจ target ก่อน ไม่มีการอนุมัติ Production จากคำขอวิเคราะห์นี้

## ชุดตรวจรับรวม

| กลุ่ม | สิ่งที่ต้องยืนยัน |
| --- | --- |
| Assets | manifest/worker/icons ได้ response ถูกต้องก่อน login, MIME และ scope ถูกต้อง |
| Install | Android Chrome, desktop Chrome/Edge และ iOS Home Screen; accept/dismiss/manual fallback/standalone |
| Reliability | offline launch หลัง cache พร้อม, retry URL เดิม, slow network, RSC navigation, อ่าน/บันทึกล้มเหลว |
| Privacy | Cache Storage มีเฉพาะ 5 URL สาธารณะตาม allowlist; logout/สลับบัญชี/tenant ไม่เห็นข้อมูลเก่าผ่าน cache |
| Updates | cache รุ่นเก่าถูกลบเฉพาะ prefix ของแอป; editor ไม่ถูก force reload |
| Mobile | เส้นทางหลัก, keyboard, safe area, dialogs, focus, scrolling และหมุนจอ |
| Share | รองรับ/ไม่รองรับ/ยกเลิก/clipboard fail และเงื่อนไขสิทธิ์เดิม |
| Push ถ้าทำ | permission ทุกสถานะ, delivery/click, subscription หมดอายุ และการแยกผู้รับ |
| Code | typecheck, lint, relevant/full tests และ build ผ่านหลัง implementation; review และอัปเดต docs |

## ผลตรวจที่รันจริงในรอบนี้

- ตรวจ source ของ manifest, provider, install dialog, worker, offline assets, root/admin layout, sidebar, security headers และตัวอย่าง capability ที่เกี่ยวข้อง
- `node --test tests/pwa-worker.test.ts`: **ผ่าน 5/5**, fail 0
- Tests เป็น VM จำลอง browser APIs: ยืนยัน fallback/privacy boundary, bypass requests, HTTP errors, offline assets และ update cleanup ตามที่ทดสอบ ไม่ทดแทน E2E/browser/physical-device tests
- แผนเดิม `docs/superpowers/plans/2026-09-10-pwa.md` รายงานผล build/typecheck/browser จากรอบก่อน รายงานนี้ไม่ถือว่าเป็นผลรันใหม่ และจำนวน cache entries ในแผนเก่าไม่ตรงกับ allowlist ปัจจุบันซึ่งมี 5 URL
- ไม่รัน build/typecheck/full suite ใหม่ เนื่องจากรอบนี้เพิ่มเอกสารวิเคราะห์เท่านั้น ไม่มีการแก้โค้ดหรือพฤติกรรมระบบ
- ยังไม่ได้วัด performance, ตรวจ HTTPS deployment หรือทดสอบเครื่อง Android/iOS จริงในรอบนี้

ข้อเสนอการดำเนินการฉบับรวม: เก็บ baseline performance/behavior และกำหนด cache policy → ประเมินและทำ Workbox injectManifest migration เมื่ออนุมัติ dependency → ปิดช่องว่าง network/loading/mobile/accessibility และ native share → ตรวจรับบน Staging/อุปกรณ์จริง → ทำ Push หลังระบุเหตุการณ์และผู้รับ → พิจารณา Store/offline data ตามขอบเขตธุรกิจ หากยังไม่ขยาย worker สามารถปิดช่องว่าง UX และทำ baseline กับ worker เดิมได้ทันที

การตรวจเพิ่มเติมรอบรวมคลิป: อ่าน chapter จาก YouTube และข้อความในสไลด์ 50 หน้า ตรวจเอกสาร Workbox ทางการ และค้น dependency ซ้ำ การแก้ไขยังเป็นเอกสารเท่านั้น ผล tests 5/5 ด้านบนเป็นผลที่รันในรอบวิเคราะห์แรกของงานนี้ ไม่มีการรัน build/typecheck หรือประกาศว่า migration ผ่านแล้ว
