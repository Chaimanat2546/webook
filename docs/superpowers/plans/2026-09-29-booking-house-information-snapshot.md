# Booking House Information Snapshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** ให้ booking เก็บและแก้ไข snapshot ข้อมูลที่พักของตนเอง โดยใช้ schema Production เป็นฐานและไม่แก้ listing/house

**Architecture:** listings เป็นแหล่งค่าเริ่มต้นเฉพาะตอนสร้าง booking; repository map ชื่อ field ของ listing เป็น contract ชื่อ field ของ booking ก่อนส่งต่อ service และ UI. หลังจากนั้นทุก read/update ใช้ bookings และ RPC เท่านั้น โดย migration ใหม่เพิ่มเวลาและขยาย RPC contract ให้บันทึกทั้งสี่ค่า

**Tech Stack:** Next.js App Router 16, React 19, TypeScript strict, Supabase/PostgreSQL, Node.js Test Runner, ESLint

**Spec:** docs/superpowers/specs/2026-09-29-booking-house-information-snapshot-design.md

## Global Constraints

- Production schema ปัจจุบันเป็น source of truth; ห้ามใช้ migration/snapshot เก่าเป็นฐานตัดสิน schema
- ห้ามแก้ migration เดิม; สร้างเฉพาะ supabase/migrations/20260929140000_booking_house_information_snapshot.sql
- ไม่เปลี่ยน listings, house, agents หรือ agent_accounts
- ห้ามให้การแก้ข้อมูล booking เขียนกลับ listing/house
- ไม่รวม agency selector ในงานนี้ และไม่เพิ่ม dependency
- ห้าม apply migration หรือ deploy ก่อนตรวจ Production schema ซ้ำ สรุปผล และได้รับการยืนยัน

## Review Focus

- ค่า 0 ต้องแสดงและบันทึกเป็นจำนวนเงินจริง ไม่ถูกตีความว่าไม่มีค่า — Task 1 และ 3
- ผู้ใช้ล้างค่า booking เป็น null แล้วเปิด editor เดิม ต้องไม่ fallback ไปใช้ listing — Task 2 และ 3
- Listing เปลี่ยนหลังสร้าง booking ต้องไม่เปลี่ยนค่าที่อ่านจาก booking — Task 2
- RPC ต้องปฏิเสธ key ชื่อเก่าและเวลา/จำนวนเงินที่ไม่ถูกต้อง — Task 4
- สถานะ repair ต้องรักษากฎลูกค้า/ยอดเงินเดิมโดยไม่ทำข้อมูลที่พักหาย — Task 1 และ 4

---

## File Structure

- lib/house-bookings.ts — contracts และ validation ของ booking
- lib/booking-house-information.ts — fallback สำหรับ creation defaults
- server/repositories/house-bookings.ts — map booking row, listing defaults และ RPC payload
- server/services/house-bookings.ts — creation snapshot boundary
- app/admin/houses/[propertyId]/bookings/actions.ts — server action สำหรับ defaults ตอนสร้าง
- components/admin/houses/bookings/booking-house-information.tsx และ booking-house-information-details.tsx — create/edit display boundary
- components/admin/houses/bookings/booking-editor.tsx — draft และ props ของ form
- supabase/migrations/20260929140000_booking_house_information_snapshot.sql — time columns และ RPC
- tests/booking-house-information-override.test.ts, tests/booking-house-information.test.ts, tests/house-booking-service.test.ts — unit/contract coverage
- docs/house-bookings.md — data flow และ Production-aligned documentation

### Task 1: Booking Contract และ Validation

**Files:**
- Modify: lib/house-bookings.ts
- Modify: lib/booking-house-information.ts
- Test: tests/booking-house-information-override.test.ts

**Interfaces:**
- Produces BookingHouseInformation และ BookingUpdate ที่มี insurance, extra_person, checkin_time, checkout_time
- Produces parseBookingUpdate(value: unknown): BookingUpdate และ parseBookingCreate(value: unknown): BookingCreate

- [ ] **Step 1: Write failing validation tests**
  - Assert that insurance=3000, extra_person=300 and short times parse to the booking-named normalized values.
  - Assert that negative amount, invalid time, and legacy insurance_fee/extra_beds keys are rejected.
  - Assert that repair retains its existing money/customer normalization without clearing house information.

- [ ] **Step 2: Verify RED**
  - Run: node --import ./tests/register-server-only.mjs --test tests/booking-house-information-override.test.ts
  - Expected: FAIL because the contract still exposes legacy fields.

- [ ] **Step 3: Implement renamed booking fields**
  - Replace extra_beds with extra_person and insurance_fee with insurance in BookingHouseInformation, BookingUpdate, BookingCreate, parser output, and fallback helper.
  - Preserve nullable money/time validation, normalized seconds, zero values, and repair behavior.

- [ ] **Step 4: Verify GREEN**
  - Run: node --import ./tests/register-server-only.mjs --test tests/booking-house-information-override.test.ts
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - git add lib/house-bookings.ts lib/booking-house-information.ts tests/booking-house-information-override.test.ts
  - git commit -m "feat: rename booking house information fields"

### Task 2: Repository และ Service Snapshot Boundary

**Files:**
- Modify: server/repositories/house-bookings.ts
- Modify: server/services/house-bookings.ts
- Modify: tests/house-booking-service.test.ts
- Modify: tests/booking-house-information.test.ts

**Interfaces:**
- Consumes Task 1 booking contracts
- Produces HouseBookingsRepository.bookingCreationDefaults(propertyId: string): Promise<BookingHouseInformation | null>
- Produces getBookingCreationDefaults(repository, propertyId) for create-only callers

- [ ] **Step 1: Write failing repository and service tests**
  - Assert bookingCreationDefaults("12") maps listing insurance_fee/extra_beds to insurance/extra_person.
  - Assert only repository code queries listing source names.
  - Assert create merges missing fields with defaults, while update/cancel make zero listing-default calls.

- [ ] **Step 2: Verify RED**
  - Run: node --import ./tests/register-server-only.mjs --test tests/booking-house-information.test.ts tests/house-booking-service.test.ts
  - Expected: FAIL because the creation-default method and field mapping do not exist.

- [ ] **Step 3: Implement the snapshot boundary**
  - Repository selects listing extra_beds, insurance_fee, checkin_time, checkout_time only inside bookingCreationDefaults and maps them to booking names.
  - Booking selection, mapBooking, create merge, and update RPC payload use insurance, extra_person, checkin_time, checkout_time.
  - Keep listing defaults exclusive to create flow.

- [ ] **Step 4: Verify GREEN**
  - Run: node --import ./tests/register-server-only.mjs --test tests/booking-house-information.test.ts tests/house-booking-service.test.ts tests/booking-house-information-override.test.ts
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - git add server/repositories/house-bookings.ts server/services/house-bookings.ts tests/house-booking-service.test.ts tests/booking-house-information.test.ts tests/booking-house-information-override.test.ts
  - git commit -m "feat: snapshot listing house information on booking create"

### Task 3: Editor and Server Action Boundary

**Files:**
- Modify: app/admin/houses/[propertyId]/bookings/actions.ts
- Modify: components/admin/houses/bookings/booking-house-information.tsx
- Modify: components/admin/houses/bookings/booking-house-information-details.tsx
- Modify: components/admin/houses/bookings/booking-editor.tsx
- Test: tests/booking-house-information.test.ts

**Interfaces:**
- Consumes getBookingCreationDefaults from Task 2
- Produces getBookingCreationDefaultsAction(propertyId: string) and a BookingHouseInformation component with loadDefaults: boolean

- [ ] **Step 1: Write failing editor behavior tests**
  - Assert rendered fields use insurance/extra_person.
  - Assert a new draft requests defaults, an existing booking does not request them, and a cleared existing value remains null.

- [ ] **Step 2: Verify RED**
  - Run: node --import ./tests/register-server-only.mjs --test tests/booking-house-information.test.ts
  - Expected: FAIL because the UI/action always loads listing data and uses legacy names.

- [ ] **Step 3: Implement create/edit separation**
  - Rename the action to getBookingCreationDefaultsAction.
  - Pass loadDefaults={!booking} from the editor.
  - When false, render detail data from saved booking values; when true, request create defaults.
  - Update labels, draft creation, initial parsing, props, and values to booking field names while retaining existing UI primitives.

- [ ] **Step 4: Verify GREEN**
  - Run: node --import ./tests/register-server-only.mjs --test tests/booking-house-information.test.ts tests/booking-house-information-override.test.ts
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - git add app/admin/houses/[propertyId]/bookings/actions.ts components/admin/houses/bookings/booking-house-information.tsx components/admin/houses/bookings/booking-house-information-details.tsx components/admin/houses/bookings/booking-editor.tsx tests/booking-house-information.test.ts tests/booking-house-information-override.test.ts
  - git commit -m "feat: edit booking house information independently"

### Task 4: Production-Aligned Migration and RPC Validation

**Files:**
- Create: supabase/migrations/20260929140000_booking_house_information_snapshot.sql
- Modify: tests/booking-house-information-override.test.ts

**Interfaces:**
- Consumes Production RPC signatures admin_create_house_booking(bigint, uuid, uuid, jsonb) and admin_update_house_booking(bigint, bigint, timestamptz, uuid, jsonb)
- Produces nullable bookings.checkin_time/checkout_time and RPC JSON keys insurance, extra_person, checkin_time, checkout_time

- [ ] **Step 1: Write failing migration contract tests**
  - Assert the migration adds only the two time columns.
  - Assert RPC allowlists, insert/update paths use insurance/extra_person and reject legacy keys.
  - Assert service-role grant/revoke statements remain present.

- [ ] **Step 2: Verify RED**
  - Run: node --import ./tests/register-server-only.mjs --test tests/booking-house-information-override.test.ts
  - Expected: FAIL because the migration file does not exist.

- [ ] **Step 3: Create the forward migration from the Production RPC contract**
  - Add the two nullable time columns.
  - Replace both RPC bodies while preserving signature, row lock, idempotency, status rules, audit actor setting, errors, grants, and PostgREST schema reload.
  - Validate nullable amounts/times and persist only booking columns.

- [ ] **Step 4: Verify GREEN**
  - Run: node --import ./tests/register-server-only.mjs --test tests/booking-house-information-override.test.ts
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - git add supabase/migrations/20260929140000_booking_house_information_snapshot.sql tests/booking-house-information-override.test.ts
  - git commit -m "feat: persist booking house information snapshots"

### Task 5: Documentation and Full Verification

**Files:**
- Modify: docs/house-bookings.md

**Interfaces:**
- Documents Task 2 creation snapshot and Task 3 existing-booking isolation

- [ ] **Step 1: Verify documentation currently fails the source-of-truth search**
  - Run: rg -n "bookings\\.(extra_beds|insurance_fee)|agents.*numeric|agent_accounts.*numeric" docs/house-bookings.md
  - Expected: finds obsolete Production-incompatible documentation.

- [ ] **Step 2: Update documentation**
  - Replace the accommodation-information section with the approved mapping and edit isolation.
  - Remove numeric-agent and obsolete migration/deployment claims.
  - State that the new migration requires Production reinspection and confirmation before apply/deploy.

- [ ] **Step 3: Run full verification**
  - Run: npm run typecheck
  - Run: npm run lint
  - Run: npm test
  - Run: git diff --check
  - Expected: every command exits 0 and the test suite passes.

- [ ] **Step 4: Commit**
  - git add docs/house-bookings.md
  - git commit -m "docs: align booking house information with production"

## Deployment Gate

Before any migration apply or deploy, inspect Production metadata again and summarize that bookings still has insurance/extra_person, lacks the two time columns, and that the current RPCs lack the four keys. Wait for explicit user confirmation before applying to Staging. After apply, re-check schema/RPC, then use only npm run deploy:cf:staging and verify the bundle has the Staging reference with no Production reference.

