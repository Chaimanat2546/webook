# Login Location History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Use superpowers:subagent-driven-development only when the execution method is explicitly chosen. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** บันทึกล็อกอินสำเร็จพร้อมพิกัดที่เลือกแชร์ครั้งเดียว มีหน้าประวัติและสิทธิ์ที่ปลอดภัย โดยรอกฎบังคับพิกัดจากผู้บริหาร

**Architecture:** Server Action → service → repository → Supabase; browser เรียก Location API แล้วส่งผลเข้า Route Handler ที่ตรวจ session ก่อนใช้ service-only atomic RPC. ใช้ scheduled Worker เดิมลบข้อมูลหมดอายุ

**Tech Stack:** Next.js 16.4.2 / React / strict TypeScript / Supabase Auth+PostgreSQL / OpenNext Cloudflare Worker / Node.js Test Runner / UI เดิม

**Spec:** `docs/superpowers/specs/2026-10-26-login-location-history-design.md`

สถานะ: ร่างแผน ไม่ใช่คำสั่งเริ่ม implementation; ยังไม่มี migration หรือการเปลี่ยน runtime

## Global Constraints

- กฎบังคับพิกัดรอผู้บริหารกำหนด; ปฏิเสธ/ข้าม/อ่านไม่ได้ยังใช้งานได้
- เก็บครั้งเดียวต่อ session; ไม่ติดตามต่อเนื่อง ไม่ backfill session เก่า ไม่รวมระบบ seller ภายนอก
- user_id หมายถึง auth.users.id; ใช้ public.users.uid เชื่อม profile และตรวจสิทธิ์
- own history สำหรับผู้ใช้; อ่านของผู้อื่นเสนอให้เฉพาะ role_id = 1 ในฐาน WeBooks นี้
- ห้ามใช้ allow_members หรือ email fallback เพื่อเพิ่มสิทธิ์อ่านพิกัด
- ปิดทาง self-promotion เป็น role1 ในระบบจัดการผู้ใช้และ direct DB API ก่อนเปิดอ่านประวัติผู้อื่น
- retention 90 วันเป็นข้อเสนอที่ต้องยืนยันก่อนเปิดใช้จริง
- ใช้ dependency และ UI เดิม; ต้องนำเสนอ UI options ให้ภูเลือกก่อน implementation
- migration ใหม่เท่านั้น; ห้ามเก็บ secrets/tokens และห้าม log IP หรือพิกัดลง diagnostic
- อ่าน relevant guide ใน node_modules/next/dist/docs ก่อนเขียน Next.js code
- จำกัด deployment เฉพาะ Staging ตาม AGENTS.md; ไม่ deploy ในงานวางแผนนี้

## Review Focus

1. callback จากบัญชีเก่าหลัง sign-out/account switch ต้องไม่เขียนประวัติบัญชีใหม่ — Task 3/4
2. refresh, concurrent insert และ network retry ต้องไม่สร้างซ้ำหรือ overwrite metadata — Task 1/2
3. service-role bypass RLS และสิทธิ์จัดการสมาชิกต้องไม่ทำให้เห็นพิกัดผู้อื่น รวม self-promotion เป็น role1 — Task 0/1/5
4. ยอมรับพิกัดศูนย์ แต่ปฏิเสธ string/null/overflow และกรองวันไทยไม่คลาดขอบวัน — Task 1/3/5
5. log/cleanup ล้มเหลวต้องไม่ทำให้ sign-in หรือ booking maintenance พัง — Task 2/6

---

## File Structure และสัญญาที่ใช้ร่วมกัน

| กลุ่มไฟล์ | หน้าที่ |
| --- | --- |
| `lib/login-history.ts` (ใหม่) | types, validators, filters และ best-effort UA classification ที่ไม่ผูก framework |
| `server/auth/login-history.ts` (ใหม่) | verified identity/session และสิทธิ์อ่านประวัติ |
| `server/services/login-history.ts` (ใหม่) | use cases: record, attach, list, purge |
| `server/repositories/login-history.ts` (ใหม่) | Supabase query/RPC เท่านั้น รวม service-only functions |
| `supabase/migrations/20261026110000_login_history.sql` (ใหม่) | table, grants, RLS, indexes, atomic attach และ bounded purge |
| `app/login/actions.ts` (แก้) | บันทึกหลัง auth สำเร็จ และเลือก redirect |
| `app/login/location/page.tsx` (ใหม่) | authenticated explanation page สำหรับ record/session ปัจจุบัน |
| `components/auth/login-location-prompt.tsx` (ใหม่) | permission/read-once state และการส่งผล |
| `app/api/login-history/location/route.ts` (ใหม่) | same-origin JSON endpoint พร้อม validation/auth |
| `app/admin/login-history/page.tsx` (ใหม่) | server-rendered list และ date/user filters |
| `components/admin/login-history/history-list.tsx` (ใหม่) | responsive display ด้วย Table/Card เดิม |
| `components/layout/admin-desktop-sidebar.tsx`, `admin-no-access.tsx` (แก้) | ลิงก์ของตนเอง ใช้ได้บน desktop/mobile sidebar และ no-access screen |
| `lib/mobile-navigation.ts` (แก้เฉพาะ title mapping) | ชื่อหน้าประวัติ; ไม่เปลี่ยน landing/dock destinations |
| `worker.ts` (แก้) | เรียก purge แยก failure boundary จาก booking |
| `app/admin/users/actions.ts`, `server/services/webook-users.ts`, `server/repositories/webook-users.ts` (แก้) | ปิด privilege escalation ก่อนใช้ role1 อนุญาตอ่านพิกัดผู้อื่น |
| migration สิทธิ์ `public.users` ใหม่ (ถ้าตรวจพบ direct write path) | ปิดการแก้ role_id/uid ผ่าน authenticated Data API/RPC |
| `docs/login-history.md` (ใหม่) | operation, failure, retention, privacy และ rollout |

Types ใน `lib/login-history.ts`:

- `LoginLocationStatus`: ตาม enum 7 ค่าใน spec; `LocationReport` เป็น success payload หรือ terminal error/skip payload
- `LoginActor { userId: string; sessionId: string }`; ใช้ฝั่ง server ไม่ส่ง sessionId เข้า UI
- `LoginHistoryEntry`: fields ตรง schema ใน spec, UI ใช้ DTO ที่ตัด session_id ออก
- `RecordLoginInput`: actor, loggedInAt ISO string, ipAddress nullable, os, browser, deviceType
- `HistoryScope`: `{ kind: "self"; userId: string } | { kind: "root-admin"; userId: string }`
- `HistoryFilter`: user query, from/to YYYY-MM-DD, page integer >=1, pageSize default25/max100
- `HistoryPage`: entries, page, pageSize, total; entries มี display profile จาก uid mapping เท่านั้น

เมื่อเริ่มงาน ให้ยืนยันแบบและตัวเลือก UI ใน spec ก่อน ตาม workflow ของ AGENTS.md
จากนั้นทำแต่ละ Task แบบ test แดง → implementation → test เขียว → review diff
commit แยก task เมื่อ execution workflow อนุญาต ไม่จำเป็นต้อง commit ในรอบวางแผน

### Task 0: ปิดทางเลื่อนสิทธิ์เป็นผู้ดูแลหลักก่อนเปิดประวัติรวม

**Files:** user actions/service/repository เดิมตาม File Structure, migration ใหม่หาก grants/RLS เปิด direct write

**Tests:** `tests/webook-user-management-auth.test.ts`, `tests/webook-user-management-service.test.ts`, `tests/webook-user-management-repository.test.ts`; SQL integration ใน `supabase/tests/login-history.sql`

**Interfaces:** `UserUpdateActor { authUserId: string }` สร้างจาก verified server identity เท่านั้น;
เพิ่ม actor เป็น required input ของ `updateWebookUser` และ guarded repository update ไม่รับ actor role จาก form
ตรวจ role/uid ของ actor และ target แบบ atomic ที่ฐานข้อมูลก่อน mutation

- [ ] ตรวจทุก call site ของ `updateWebookUser`, การแก้ public.users และ RPC/grants/RLS ที่เกี่ยวข้อง; ระบุ direct mutation paths ที่ต้องปิดก่อนเปิด history รวม
- [ ] เขียน failing tests: allow_members/non-root เปลี่ยนตนเองหรือคนอื่นเป็นrole1ไม่ได้; แก้ root target ทั้ง details/permissions ไม่ได้; ปลอม actor/role ใน form ไม่ได้
- [ ] เขียน tests: root ที่ผ่าน user-manager guard เดิมยังแก้ผู้ใช้ได้; non-root ยังแก้ non-root เป็น non-root ได้; actor ถูกถอนroleหรือtargetเลื่อนเป็นrootระหว่างคำขอต้องถูกปฏิเสธ
- [ ] เขียน SQL behavioral tests: authenticated เปลี่ยน role_id/uid เพื่อเพิ่มสิทธิ์ผ่าน direct API/RPC ไม่ได้; user A ไม่สามารถยกระดับแล้วอ่านพิกัด B ได้
- [ ] รันให้แดง แล้วเพิ่ม atomic authorization ในเส้นทางเขียนเดิมและปิด direct write path ที่ตรวจพบด้วย migrationใหม่; ห้ามเพิ่ม root access ให้ผู้มี allow_members โดยอัตโนมัติ
- [ ] รัน existing user-management tests และ SQL integration ให้ผ่าน; อัปเดต runbook ว่าผู้จัดการสมาชิกที่ไม่ใช่rootแก้rootไม่ได้แล้ว
- [ ] ถ้าปิดเส้นทางเลื่อนสิทธิ์ทั้งหมดไม่ได้ในขอบเขตงาน ให้ปิดฟังก์ชันดูประวัติผู้อื่นไว้และรายงานช่องว่าง ห้ามอ้างว่า read-role policy อย่างเดียวเพียงพอ

### Task 1: Schema, RLS และ repository ที่ทดสอบสิทธิ์ได้

**Files:** migration ใหม่, `lib/login-history.ts`, `server/repositories/login-history.ts`

**Tests:** `tests/login-history-repository.test.ts`, `supabase/tests/login-history.sql` (ใหม่)

**Interfaces:**

- `createLoginHistoryRepository(client: SupabaseClient): LoginHistoryRepository`
- Repository: `record(input: RecordLoginInput): Promise<LoginHistoryEntry>`, `current(actor: LoginActor): Promise<LoginHistoryEntry | null>`
- Repository: `attach(actor: LoginActor, report: LocationReport): Promise<LoginHistoryEntry>`, `list(scope: HistoryScope, filter: HistoryFilter): Promise<HistoryPage>`, `purgeExpired(): Promise<number>`
- `LocationReport` รวม `historyId`; attach RPC รับ actor จาก server และตรวจ session มีอยู่จริง
- typed failure แยก invalid/not-found/conflict/storage; ห้ามส่งข้อความ DB ไป client

- [ ] เขียน failing repository behavior tests: concurrent record key เดียวคืน row เดียว; duplicate ไม่แก้ IP/เวลา; attach pending→terminal; replay เดิมสำเร็จ; conflicting payload ไม่แก้ข้อมูล
- [ ] เขียน SQL integration assertions: anon อ่าน/เขียนไม่ได้; A ไม่เห็น B; root admin เห็นในฐานนี้; allow_members อย่างเดียวไม่ได้สิทธิ์; direct UPDATE/INSERT/DELETE ถูกปฏิเสธ
- [ ] เพิ่ม SQL tests สำหรับ FK auth.user, ไม่มี FK session, การลบบัญชี cascade, lat/lon 0 และ DB constraints, RPC EXECUTE denied สำหรับ authenticated
- [ ] รัน Node tests ให้เห็น failure ก่อน implement; SQL tests ใช้ local Supabase ที่แยกจาก Production
- [ ] เพิ่ม migration ใหม่ตาม spec พร้อม SELECT policies และ private root helper ที่ fixed search_path; service-only attach/purge RPC; atomic insert-on-conflict ไม่ overwrite
- [ ] Implement repository ที่ query ด้วย user/session scope; service-role list ต้องประกอบ scope เสมอ ไม่รับ raw filter expression จาก client
- [ ] รัน repository tests และ `npx supabase test db` กับ local ที่ apply migration แล้ว; ต้องผ่าน behavioral RLS/RPC assertions จริง

### Task 2: บันทึกหลัง sign-in โดยไม่สร้าง log จาก session refresh

**Files:** `server/auth/login-history.ts`, `server/services/login-history.ts`, `app/login/actions.ts`, `lib/login-history.ts`

**Tests:** `tests/login-history-auth.test.ts`, `tests/login-history-service.test.ts` (ใหม่), regression `tests/login-landing.test.ts`

**Interfaces:**

- `requireLoginActor(): Promise<LoginActor>` ตรวจ verified claims และ auth identity จาก token เดียวกัน
- `recordSuccessfulLogin(repository: LoginHistoryRepository, input: RecordLoginInput): Promise<LoginHistoryEntry>`
- `classifyLoginDevice(userAgent: string | null): { os: string; browser: string; deviceType: DeviceType }`
- Service history reader Task 5 ใช้ `resolveHistoryScope(actor: LoginActor): Promise<HistoryScope>` ซึ่งอ่าน role ผ่าน uid เท่านั้น

- [ ] เขียน tests: auth fail ไม่ insert; auth success insert ก่อน redirect; refresh/visit `/` ไม่ insert; session ใหม่ของ user เดิมเป็นคนละแถว
- [ ] เขียน tests: verified sub/session ไม่ตรงถูกปฏิเสธ; ไม่มี public.users mapping ยังบันทึกได้; email fallback ไม่ให้ root scope
- [ ] เขียน tests: UA ว่าง/แปลก/ยาวได้ unknown/ค่าจำกัด 100 ตัวอักษร; CF ingress IP ใช้ได้, untrusted forwarded header และ local เป็น null
- [ ] เขียน tests: transient insert failure retry ครั้งเดียวด้วย input เดิม; storage ล้มเหลวยัง redirect `/`; ไม่เรียก auth sign-in ซ้ำและไม่ทิ้ง promise หลัง response
- [ ] รัน tests ให้แดง แล้ว implement record path และ metadata budget รวม 3 วินาที; รักษา Push account-change cleanup เดิม
- [ ] เมื่อมี record จึง redirect `/login/location`; ไม่มี record ให้ไป `/` และ diagnostic แบบ redacted; ข้อมูลขัดแย้ง duplicate ต้องคืนของเดิม
- [ ] รัน auth/service tests และ login landing regression ให้ผ่าน

### Task 3: API แนบพิกัดเข้ารายการของ session ปัจจุบัน

**Files:** `app/api/login-history/location/route.ts`, service/auth/lib/repository จาก Task 1/2

**Tests:** `tests/login-history-location-api.test.ts` (ใหม่), SQL assertions จาก Task 1

**Interfaces:**

- `parseLocationReport(value: unknown): LocationReport` ตรวจ payload ตาม spec
- `attachLoginLocation(repository: LoginHistoryRepository, actor: LoginActor, report: LocationReport): Promise<LoginHistoryEntry>`
- POST รับ `historyId + status + success fields` เท่านั้น; success คืน `{ saved: true }` โดยไม่คืน session UUID

- [ ] เขียน API tests: missing/expired/revoked session →401; cross-origin→403; body >2KiB→400; malformed JSON/UUID→400
- [ ] เขียน validation tests: finite numeric lat [-90,90], lon [-180,180], accuracy>=0; 0 ผ่าน; string/null/out-of-range ไม่ผ่าน; terminal error ที่มี coordinates ถูกปฏิเสธ
- [ ] เขียน tests: timestamp valid และไม่อนาคตเกิน60วินาที/ไม่ก่อนlogin; อายุรายการเกิน10นาที→409
- [ ] เขียน tests: A ส่ง history ของ B หรือ session เก่าของ A→404; callback A หลังเปลี่ยนบัญชี B→404; session row ถูก revoke ปฏิเสธก่อน update
- [ ] เขียน tests: same report retry→200; conflicting terminal report→409; simultaneous terminal reports เปลี่ยน row ได้ครั้งเดียว; DB fail→503 และ no-store ทุก response
- [ ] รันให้แดง แล้ว implement route ที่จำกัด body ก่อน parse ตรวจ trusted origin และส่งต่อ service; รักษา atomic session/ownership/window check ใน DB
- [ ] รันทดสอบ API และ SQL integration เพื่อยืนยันว่าไม่มี read-then-write race

### Task 4: หน้าอธิบายและอ่านพิกัดหนึ่งครั้ง

**Files:** `app/login/location/page.tsx`, `components/auth/login-location-prompt.tsx`

**Tests:** `tests/login-history-location-client.test.ts` (ใหม่)

**Interfaces:** หน้า server ส่งเฉพาะ historyId และสถานะ; client รับ `getCurrentPosition`/transport ที่ inject เพื่อทดสอบได้โดยไม่เพิ่ม library

- [ ] นำเสนอ Card หน้าคำอธิบายและปุ่มแชร์/ข้ามตาม spec ให้ภูเลือกก่อน implementation
- [ ] เขียน behavioral tests ด้วย fake geolocation: success, denied, unavailable, timeout, unsupported, skip; ก่อนกดแชร์เรียก geolocation 0 ครั้ง หลังดับเบิลคลิก/re-render ไม่เกิน1ครั้ง
- [ ] เขียน tests: watchdog15วินาทีจบ UI ได้; late callback ไม่ส่งซ้ำ; account switch/signout/unmount ทิ้งผลเดิม; Strict Mode ไม่ทำให้อ่านซ้ำ
- [ ] เขียน tests: API fail แสดงสถานะบันทึกไม่สำเร็จ ให้ไปต่อและ retry payload เดิมได้โดยไม่อ่านใหม่; pending เก่ากว่า10นาทีไม่ขอพิกัดใหม่
- [ ] รันให้แดง แล้ว implement getCurrentPosition options ตาม spec; ไม่มี watchPosition, background tracking, localStorage หรือ offline queue ที่เก็บ coordinates
- [ ] หน้าอ่าน current row ด้วย user/session; ไม่มี row หรือ row เสร็จแล้ว redirect `/`; ตรวจ auth โดยไม่สร้างประวัติใน render
- [ ] รัน tests และตรวจบน HTTPS Staging ภายหลัง ทั้ง Chrome Android และ Safari/iOS/PWA; ทดสอบ keyboard/focus และ permission ที่เคยปฏิเสธแล้ว

### Task 5: หน้าประวัติและการค้นหาตามสิทธิ์

**Files:** `app/admin/login-history/page.tsx`, `components/admin/login-history/history-list.tsx`, service/auth/repository; sidebar/no-access/mobile title ตาม File Structure

**Tests:** `tests/login-history-access.test.ts`, `tests/login-history-list.test.ts` (ใหม่)

**Interfaces:** `listLoginHistory(repository: LoginHistoryRepository, scope: HistoryScope, filter: HistoryFilter): Promise<HistoryPage>`
scope derive จาก server ทุก request; user filter ทำงานได้เฉพาะ root admin

- [ ] นำเสนอ Table+Card (แนะนำ) เทียบ Table scroll และการใช้ date picker เดิม; ไม่ใช้ House Workspace Shell เพราะเป็นประวัติบัญชี
- [ ] เขียน tests: user A อ่านได้เฉพาะ A แม้แก้ URL/query; role_id1 อ่านผู้ใช้อื่นได้ในฐานนี้; allow_members อย่างเดียว/uid mapping หายไม่เพิ่มสิทธิ์
- [ ] เขียน tests: filter user/name/email ผ่าน uid ที่ตรงจริง; no profile mapping แสดง fallback ไม่จับคู่ด้วย email; invalid filter ไม่กลายเป็น unrestricted query
- [ ] เขียน tests: วันไทย 2026-10-26 เริ่ม UTC 2026-10-25T17:00:00Z และสิ้นสุด exclusive 2026-10-26T17:00:00Z; ช่วงกลับด้านถูกปฏิเสธ
- [ ] เขียน tests: 25แถวต่อหน้า, max100, stable sort logged_in_at/id, empty/error state, ไม่ส่ง sessionId/token ใน DTO
- [ ] รันให้แดง แล้ว implement server search/pagination และรายการที่แสดง accuracy/status อย่างตรงไปตรงมา; ไม่โหลดแผนที่อัตโนมัติ
- [ ] เพิ่มลิงก์ sidebar ทั้งdesktop/mobileและno-access; title mapping เท่านั้นไม่เพิ่ม landing module หรือเปลี่ยน dock order
- [ ] รัน tests และตรวจ responsive/keyboard; ยืนยันข้อมูลผู้ใช้ไม่เข้า PWA cache หรือ offline replay

### Task 6: ลบข้อมูลหมดอายุบน scheduler เดิม

**Files:** `worker.ts`, service/repository/migration จาก Task 1

**Tests:** `tests/login-history-retention.test.ts`, `tests/login-history-worker.test.ts` (ใหม่)

**Interfaces:** `purgeExpiredLoginHistory(repository: LoginHistoryRepository): Promise<number>`; RPC ใช้ DB clock, fixed90วัน และ batch1000

- [ ] เขียน tests: เก่ากว่า90วันถูกลบทั้ง row, เท่ากับ cutoff ยังอยู่, ใหม่กว่า cutoff ยังอยู่; batchไม่เกิน1000และเรียงเก่าสุด
- [ ] เขียน SQL integration: purge RPC เรียกจาก authenticated/anon ไม่ได้; concurrent purge ไม่ลบข้อมูลใหม่และเรียกซ้ำได้
- [ ] เขียน Worker tests: cleanup fail ยังทำ booking; booking fail ยังเรียก cleanup; logging ไม่มี credentials/IP/coordinates; backlog ที่เต็ม batchมี diagnostic เพื่อติดตาม
- [ ] รันให้แดง แล้วใช้ cron tickเดิมเรียก cleanup โดยแยก failure boundary; ไม่เพิ่ม schedulerหรือenv secret
- [ ] รัน retention/worker tests และ regression scheduled booking tests; ถ้า configจริงไม่ได้ทุกนาทีให้ระบุและปรับแผนก่อน implementation

### Task 7: Review, ตรวจครบ และ rollout

**Files:** `docs/login-history.md`, `docs/webook-user-management.md` (แก้เฉพาะ permission ปัจจุบันที่ตรวจยืนยัน), แผนนี้สำหรับติดตามงาน

- [ ] บันทึก operation/runbook: วิธีตรวจ log missing, ขอบเขต fail-open, การตรวจ purge backlog, no backfill, การลบบัญชี/backup lifecycle และการถอน rollout
- [ ] Review diff ให้ครบ8ข้อของภู โดยเน้น server authorization, prerequisite Task0 และ behavioral SQL tests; ไม่ถือว่าอ่าน migration text เท่ากับทดสอบ RLSจริง
- [ ] รัน `npm run verify` ต้องexit0 (typecheck, lint, tests); รัน `npm run build` ต้องexit0
- [ ] ก่อนเปิดใช้จริงยืนยัน retention90วัน ขอบเขตroot-admin และข้อความแจ้งผู้ใช้; ยังไม่มีข้อกำหนดบังคับพิกัดจนกว่าจะได้รับกฎ
- [ ] หากได้รับงานให้ทดสอบ deploy: ยืนยัน Supabase Staging `https://sxvkhzhqtrpxgzumsswl.supabase.co` และ Cloudflare account `0df55f166fa309dcc904e992c43f86db`
- [ ] Apply migrationกับ Staging ผ่านworkflowที่repoอนุญาตก่อน; web deployใช้ `npm run deploy:cf:staging` เท่านั้น ตรวจ environmentโดยไม่พิมพ์secrets
- [ ] Smoke testสองบัญชี/สองsession, permission success/denied, DB/API fail, replay/race และ cleanup; เก็บผลจริงไว้ในrunbook
- [ ] Rollbackด้วยหยุดproducer/prompt/worker cleanupตามrelease rollbackที่ตรวจแล้ว ไม่dropตารางหรือทำลายประวัติอัตโนมัติ

## การตรวจแผนรอบนี้

งานรอบนี้เป็นเอกสารเท่านั้น ไม่เปลี่ยน code/schema/runtime จึงไม่ต้องรัน build/typecheck/test
ต้องตรวจ diff, path ที่อ้างถึง และความครบถ้วนของข้อกำหนดก่อนส่งมอบ
การอนุมัติแผนไม่ได้เท่ากับอนุมัติ Production deployment
