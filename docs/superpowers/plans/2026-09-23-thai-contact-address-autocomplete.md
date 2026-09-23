# Thai Contact Address Autocomplete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local-data-backed Thai postal-code address autocomplete to booking customers' contact address while preserving manual entry and existing persistence fields.

**Architecture:** A reproducible script vendors GeoThai v4 and generates a compact server-only data module. A geography adapter and service expose typed hierarchical lookups to authenticated booking Server Actions. A focused client component uses the existing Combobox primitives, keeps geographic codes transiently, and writes the selected Thai names into the existing customer input fields.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, Base UI Combobox, Node test runner, GeoThai v4 local JSON data.

**Spec:** `docs/superpowers/specs/2026-09-23-thai-contact-address-autocomplete-design.md`

## Global Constraints

- Apply autocomplete only to booking customers' contact address; tax-invoice address stays a free-text field.
- Field order is address detail, country, postal code, Province, District/area, Subdistrict/ward.
- Do not call external APIs at runtime; keep GeoThai v4 data and source metadata in the repository.
- Do not add dependencies or migrate the customer schema; persist existing Thai name fields, not geographic codes.
- Use the existing `components/ui/combobox.tsx` primitives; do not use native `<select>` for geographic fields.
- Validate all Server Action inputs and authorize with the existing booking-admin/house guard before lookups.
- Regenerate `public/sw.js` after source changes because the PWA revision fingerprints application source.

## Review Focus

- A five-digit postcode matching multiple Provinces must never silently select one; test that the action returns every distinct candidate.
- A manually chosen Province after a postcode lookup must clear a now-incompatible District and Subdistrict; test the client reducer/component contract.
- A legacy customer value absent from GeoThai must remain visible and editable rather than being erased; test name resolution returns `null` codes while retaining display names.
- A postcode not found in the dataset must show a non-blocking message and keep manual Province lookup available; test both service and UI contracts.
- A Subdistrict associated with multiple postcodes must not overwrite an entered postcode; test the selection result preserves the supplied value.

---

## File Structure

- `scripts/vendor-geothai-v4.mjs` — downloads GeoThai v4 data from a pinned upstream revision and writes its metadata plus source JSON below `data/geothai/v4/`.
- `scripts/generate-thai-address-data.mjs` — validates vendored source shapes and emits the compact, server-only generated TypeScript module.
- `data/geothai/v4/metadata.json`, `geo.json`, `postal_lookup.json` — vendored GeoThai source and provenance; never read by browser code.
- `server/geography/thai-address-types.ts` — stable typed options, candidates, resolved existing values, and repository contract.
- `server/geography/thai-address-data.generated.ts` — generated compact lookup indexes; committed output, not hand-edited.
- `server/geography/thai-address-repository.ts` — pure local adapter implementing the repository contract using generated indexes.
- `server/services/thai-addresses.ts` — input validation, postal candidate filtering/order, and legacy-name resolution use cases.
- `app/admin/houses/[propertyId]/bookings/actions.ts` — authenticated Server Action boundary for address lookups.
- `components/admin/houses/bookings/thai-contact-address-fields.tsx` — client-side address input, hierarchy state, requests, suggestions, and Combobox presentation.
- `components/admin/houses/bookings/booking-customer-form.tsx` — replaces only the contact-address fields with the new component.
- `tests/thai-address-repository.test.ts` — generated-data adapter/service behavior with tiny fixture injection.
- `tests/thai-address-actions.test.ts` — authorization and primitive input boundary tests.
- `tests/booking-customer-address-ui.test.ts` — source-level UI contract tests following the repository's existing UI-test convention.
- `docs/superpowers/specs/2026-09-23-thai-contact-address-autocomplete-design.md` — update only if implementation reveals a necessary design correction.

### Task 1: Vendor and normalize GeoThai data behind a typed local adapter

**Files:**
- Create: `scripts/vendor-geothai-v4.mjs`
- Create: `scripts/generate-thai-address-data.mjs`
- Create: `data/geothai/v4/metadata.json`
- Create: `data/geothai/v4/geo.json`
- Create: `data/geothai/v4/postal_lookup.json`
- Create: `server/geography/thai-address-types.ts`
- Create: `server/geography/thai-address-data.generated.ts`
- Create: `server/geography/thai-address-repository.ts`
- Test: `tests/thai-address-repository.test.ts`

**Interfaces:**
- Produces `ThaiAddressRepository` with `postalCandidates`, `provinces`, `districts`, `subdistricts`, and `resolveNames` for Tasks 2 and 3.
- `ThaiAddressOption` is `{ code: number; nameTh: string }`.
- `ThaiAddressCandidate` is `{ province: ThaiAddressOption; district: ThaiAddressOption; subdistrict: ThaiAddressOption; postalCode: string }`.

- [ ] **Step 1: Write failing repository tests using an injected fixture index**

```ts
test("postal candidates preserve ambiguity and hierarchical options prefer the postcode", () => {
  const repository = createThaiAddressRepository(fixture);
  assert.deepEqual(repository.postalCandidates("20110").map((row) => row.province.nameTh), ["ชลบุรี", "ระยอง"]);
  assert.deepEqual(repository.districts(20, "20110").map((row) => row.nameTh), ["ศรีราชา", "เมืองชลบุรี"]);
  assert.deepEqual(repository.subdistricts(2007, "20110").map((row) => row.nameTh), ["สุรศักดิ์"]);
});

test("name resolution leaves unknown legacy names unresolved", () => {
  assert.deepEqual(createThaiAddressRepository(fixture).resolveNames({ province: "ชื่อเดิม", district: "", subdistrict: "" }), {
    provinceCode: null, districtCode: null, subdistrictCode: null,
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails because the adapter does not exist**

Run: `node --import ./tests/register-server-only.mjs --test tests/thai-address-repository.test.ts`

Expected: FAIL with module-not-found or missing `createThaiAddressRepository`.

- [ ] **Step 3: Define the stable contracts and the minimal local adapter**

```ts
export interface ThaiAddressRepository {
  postalCandidates(postalCode: string): ThaiAddressCandidate[];
  provinces(postalCode?: string): ThaiAddressOption[];
  districts(provinceCode: number, postalCode?: string): ThaiAddressOption[];
  subdistricts(districtCode: number, postalCode?: string): ThaiAddressOption[];
  resolveNames(value: { province: string | null; district: string | null; subdistrict: string | null }): ThaiAddressSelection;
}
```

Implement deterministic sorting: postcode-matching options first, then Thai-name locale ordering. Deduplicate by numeric code. Resolve District only within the resolved Province and Subdistrict only within the resolved District so invalid cross-hierarchy names cannot produce an inconsistent code set.

- [ ] **Step 4: Add reproducible vendoring and generation scripts**

`vendor-geothai-v4.mjs` must download only `data/v4/metadata.json`, `geo.json`, and `postal_lookup.json` from a full commit SHA passed as a constant, validate HTTP success and JSON parseability, then write them under `data/geothai/v4/`. `generate-thai-address-data.mjs` must flatten GeoThai's Province → District → Subdistrict hierarchy, normalize each `postal_code` to a five-character string, and emit indexes keyed by postal, Province code, and District code.

Generated output must export data, not call filesystem APIs at runtime:

```ts
export const thaiAddressData = {
  provinces: [] as ThaiAddressOption[],
  districtsByProvince: {} as Record<number, ThaiAddressDistrict[]>,
  subdistrictsByDistrict: {} as Record<number, ThaiAddressSubdistrict[]>,
  candidatesByPostalCode: {} as Record<string, ThaiAddressCandidate[]>,
} as const;
```

- [ ] **Step 5: Run the generator and focused tests**

Run: `node scripts/generate-thai-address-data.mjs && node --import ./tests/register-server-only.mjs --test tests/thai-address-repository.test.ts`

Expected: PASS, including ambiguous postcodes, parent filtering, postcode priority, unknown names, and the multiple-postcode no-overwrite fixture.

- [ ] **Step 6: Commit the independently working data layer**

```bash
git add scripts/vendor-geothai-v4.mjs scripts/generate-thai-address-data.mjs data/geothai/v4 server/geography tests/thai-address-repository.test.ts
git commit -m "feat: add local Thai address lookup data"
```

### Task 2: Expose validated, authorized lookup use cases to the booking form

**Files:**
- Create: `server/services/thai-addresses.ts`
- Modify: `app/admin/houses/[propertyId]/bookings/actions.ts`
- Test: `tests/thai-address-actions.test.ts`

**Interfaces:**
- Consumes `ThaiAddressRepository` from Task 1.
- Produces `lookupThaiPostalCode`, `listThaiProvinces`, `listThaiDistricts`, `listThaiSubdistricts`, and `resolveThaiAddressNames` for the Server Actions and Task 3.

- [ ] **Step 1: Write failing service/action tests**

```ts
test("postal lookup accepts exactly five ASCII digits and returns candidates", () => {
  assert.throws(() => lookupThaiPostalCode(repository, "2011"), /รหัสไปรษณีย์ต้องมี 5 หลัก/);
  assert.deepEqual(lookupThaiPostalCode(repository, "20110").candidates[0].district.nameTh, "ศรีราชา");
});

test("district lookup rejects a non-numeric Province code before reaching the repository", () => {
  assert.throws(() => listThaiDistricts(repository, "twenty", null), /จังหวัดไม่ถูกต้อง/);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails because the service does not exist**

Run: `node --import ./tests/register-server-only.mjs --test tests/thai-address-actions.test.ts`

Expected: FAIL with module-not-found or missing exported use cases.

- [ ] **Step 3: Implement validation-first service functions**

```ts
export function lookupThaiPostalCode(repository: ThaiAddressRepository, rawPostalCode: unknown) {
  const postalCode = typeof rawPostalCode === "string" ? rawPostalCode.trim() : "";
  if (!/^\d{5}$/.test(postalCode)) throw new Error("รหัสไปรษณีย์ต้องมี 5 หลัก");
  return { postalCode, candidates: repository.postalCandidates(postalCode) };
}
```

Use a `positiveInteger` parser for geographic codes. Optional postcode accepts only an empty string or five digits. Do not expose source JSON or internal indexes.

- [ ] **Step 4: Add authenticated Server Actions**

Add actions accepting `propertyId` plus lookup primitives. Each action must call `requireBookingAdmin()`, then `requireBookingHouse(repository, propertyId)`, then the geography service, wrapped in `bookingResult`:

```ts
export async function listThaiDistrictsAction(propertyId: string, provinceCode: unknown, postalCode: unknown) {
  return bookingResult(async () => {
    const { repository } = await requireBookingAdmin();
    await requireBookingHouse(repository, propertyId);
    return listThaiDistricts(thaiAddressRepository, provinceCode, postalCode);
  });
}
```

- [ ] **Step 5: Run focused tests and the existing booking action tests**

Run: `node --import ./tests/register-server-only.mjs --test tests/thai-address-actions.test.ts tests/booking-customers.test.ts tests/booking-customer-scope.test.ts`

Expected: PASS; unauthorized/cross-house callers cannot use actions, invalid primitive input returns safe Thai validation messages, and customer service behavior is unchanged.

- [ ] **Step 6: Commit the Server Action boundary**

```bash
git add server/services/thai-addresses.ts app/admin/houses/[propertyId]/bookings/actions.ts tests/thai-address-actions.test.ts
git commit -m "feat: expose Thai address booking lookups"
```

### Task 3: Build and integrate the booking contact-address autocomplete UI

**Files:**
- Create: `components/admin/houses/bookings/thai-contact-address-fields.tsx`
- Modify: `components/admin/houses/bookings/booking-customer-form.tsx`
- Test: `tests/booking-customer-address-ui.test.ts`

**Interfaces:**
- Consumes Task 2 Server Actions and `ThaiAddressOption` / `ThaiAddressCandidate` types.
- Receives `value: BookingContactAddressValue`, `disabled: boolean`, `propertyId: string`, and `onChange(patch: Partial<BookingContactAddressValue>): void`.
- Produces patches using only existing persisted keys: `address`, `country`, `postal_code`, `province`, `district`, `sub_district`.

- [ ] **Step 1: Write failing UI-contract tests**

```ts
test("contact address renders manual detail and country before postal geography fields", () => {
  const source = readFileSync(componentUrl, "utf8");
  assert.ok(source.indexOf('label="ที่อยู่"') < source.indexOf('label="ประเทศ"'));
  assert.ok(source.indexOf('label="ประเทศ"') < source.indexOf('label="รหัสไปรษณีย์"'));
});

test("contact address uses searchable comboboxes and blocks child levels until parents exist", () => {
  assert.match(source, /ComboboxInput[\s\S]*placeholder="ค้นหาจังหวัด/);
  assert.match(source, /disabled=\{disabled \|\| provinceCode === null\}/);
  assert.match(source, /disabled=\{disabled \|\| districtCode === null\}/);
});
```

Include source-level assertions that postcode uses `type="tel" inputMode="numeric" maxLength={5}`, tax-address code remains outside this component, and `BookingCustomerForm` mounts the component only in the address group.

- [ ] **Step 2: Run the focused UI test and confirm it fails because the component does not exist**

Run: `node --import ./tests/register-server-only.mjs --test tests/booking-customer-address-ui.test.ts`

Expected: FAIL with missing component path.

- [ ] **Step 3: Implement the component state and cascade rules**

```ts
interface BookingContactAddressValue {
  address: string | null;
  country: string | null;
  postal_code: string | null;
  province: string | null;
  district: string | null;
  sub_district: string | null;
}

function chooseProvince(option: ThaiAddressOption | null) {
  setProvinceCode(option?.code ?? null);
  setDistrictCode(null);
  setSubdistrictCode(null);
  onChange({ province: option?.nameTh ?? null, district: null, sub_district: null });
}
```

Fetch Province options once when the address group mounts. Fetch District/Subdistrict options only after their parent code changes. Use monotonically increasing request tokens or an equivalent cancellation guard so a late response cannot overwrite a newer choice. Keep legacy unresolved names in the input display until the user chooses a valid option.

- [ ] **Step 4: Implement postal suggestions without locking manual choices**

On exactly five digits, call `lookupThaiPostalCodeAction`. For one unique Province candidate, call `chooseProvince`; for one compatible District candidate, call `chooseDistrict`. Do not auto-select an ambiguous Province/District/Subdistrict. For no candidates, show `ไม่พบพื้นที่สำหรับรหัสไปรษณีย์นี้ กรุณาเลือกจังหวัด อำเภอ และตำบลด้วยตนเอง` and leave all manual controls available.

When selecting a Subdistrict, derive its distinct postal codes from the currently available matching candidates. Only call `onChange({ postal_code })` when there is exactly one; otherwise preserve the form's current postal code.

- [ ] **Step 5: Replace only the existing contact-address primitive fields in `BookingCustomerForm`**

In the `group.key === "address"` branch, render `ThaiContactAddressFields` and remove the generic rendering only for `address`, `country`, `postal_code`, `province`, `district`, and `sub_district`. Keep all other `CUSTOMER_FIELDS` behavior untouched. Keep the juristic "ใช้ที่อยู่เดียวกับข้อมูลภาษี" action, which sets its existing contact fields and lets the user subsequently edit them.

- [ ] **Step 6: Run focused UI, customer validation, and accessibility-adjacent checks**

Run: `node --import ./tests/register-server-only.mjs --test tests/booking-customer-address-ui.test.ts tests/booking-customer-ui.test.ts tests/booking-customers.test.ts`

Expected: PASS; field order, Combobox usage, dependency disabling, telephone controls, unchanged summary behavior, and contact address validation are all covered.

- [ ] **Step 7: Commit the integrated form**

```bash
git add components/admin/houses/bookings/thai-contact-address-fields.tsx components/admin/houses/bookings/booking-customer-form.tsx tests/booking-customer-address-ui.test.ts
git commit -m "feat: autocomplete booking customer contact addresses"
```

### Task 4: Verify generated artifacts and the complete application

**Files:**
- Modify: `public/sw.js`
- Test: `tests/pwa-build.test.ts`

**Interfaces:**
- Consumes the completed form, server Actions, and generated dataset from Tasks 1–3.
- Produces a checked PWA service-worker revision that matches the application source.

- [ ] **Step 1: Regenerate the PWA worker**

Run: `npm run build:pwa`

Expected: reports five precached public assets and updates only the generated revision/content needed by changed source.

- [ ] **Step 2: Run all static and behavioral verification**

Run: `npm run typecheck && npm run lint && npm test`

Expected: all commands exit 0; the PWA reproducibility test passes with the regenerated worker.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: Next.js compilation, TypeScript, page generation, and trace collection complete with exit code 0.

- [ ] **Step 4: Review the final diff and commit generated worker/documentation changes**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only intended address feature, dataset, generated worker, tests, and documentation changes remain.

```bash
git add public/sw.js docs/superpowers/specs/2026-09-23-thai-contact-address-autocomplete-design.md
git commit -m "chore: refresh Thai address build artifacts"
```

## Self-Review

- Spec coverage: Tasks 1–3 cover local GeoThai data, server abstraction, postcode suggestions, manual hierarchy selection, transient codes, persistence names, legacy values, non-blocking errors, and exact field order. Task 4 covers the mandated PWA/build artifacts.
- Placeholder scan: no unfinished markers, deferred implementations, or unspecified test steps remain.
- Type consistency: Task 1 defines `ThaiAddressRepository`, `ThaiAddressOption`, and `ThaiAddressCandidate`; Task 2 consumes that repository; Task 3 consumes the action return types and writes only `BookingContactAddressValue` existing-field keys.
- Review Focus coverage: Task 1 tests postcode ambiguity and unresolved legacy names; Task 3 tests cascaded resets, unknown postcode non-blocking manual selection, and multi-postcode preservation.
