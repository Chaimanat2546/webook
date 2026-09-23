import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { createThaiAddressRequestVersions } from "../components/admin/houses/bookings/thai-contact-address-request-versions.ts";
import { createThaiContactAddressInitializationController } from "../components/admin/houses/bookings/thai-contact-address-initialization.ts";
import { createThaiContactAddressPostalLookupController } from "../components/admin/houses/bookings/thai-contact-address-postal-lookup.ts";
import { createThaiContactAddressSelectionController } from "../components/admin/houses/bookings/thai-contact-address-selection.ts";

const componentUrl = new URL("../components/admin/houses/bookings/thai-contact-address-fields.tsx", import.meta.url);
const comboboxUrl = new URL("../components/ui/combobox.tsx", import.meta.url);
const formUrl = new URL("../components/admin/houses/bookings/booking-customer-form.tsx", import.meta.url);
const customerPickerUrl = new URL("../components/admin/houses/bookings/booking-customer-picker.tsx", import.meta.url);
const postalControllerUrl = new URL("../components/admin/houses/bookings/thai-contact-address-postal-lookup.ts", import.meta.url);

test("postal and hierarchy lookup versions invalidate independently", () => {
  const versions = createThaiAddressRequestVersions();
  const postal = versions.nextPostal();
  const districts = versions.nextDistricts();

  assert.equal(versions.isPostalCurrent(postal), true);
  assert.equal(versions.isDistrictsCurrent(districts), true);

  versions.nextSubdistricts();
  assert.equal(versions.isPostalCurrent(postal), true);
  assert.equal(versions.isDistrictsCurrent(districts), true);

  versions.invalidateUserAddressChange();
  assert.equal(versions.isPostalCurrent(postal), false);
  assert.equal(versions.isDistrictsCurrent(districts), true);
});

test("a user postal selection invalidates a late initialization result", () => {
  const versions = createThaiAddressRequestVersions();
  const initialization = versions.nextInitialization();

  versions.invalidateUserAddressChange();

  assert.equal(versions.isInitializationCurrent(initialization), false);
});

test("late initialization cannot overwrite a postal-selected address", async () => {
  let resolveNames: ((value: { ok: true; data: { provinceCode: number; districtCode: number; subdistrictCode: number } }) => void) | undefined;
  const versions = createThaiAddressRequestVersions();
  const controller = createThaiContactAddressInitializationController(versions);
  const selected = { provinceCode: 88, districtCode: 8801, subdistrictCode: 880101 };
  const initialization = controller.start({
    applyProvinces: () => undefined,
    applyResolved: (value) => Object.assign(selected, value),
    isActive: () => true,
    listProvinces: async () => ({ ok: true as const, data: [] }),
    resolveNames: () => new Promise((resolve) => { resolveNames = resolve; }),
  });

  await Promise.resolve();
  controller.userChanged();
  resolveNames?.({ ok: true, data: { provinceCode: 20, districtCode: 2007, subdistrictCode: 200701 } });
  await initialization;

  assert.deepEqual(selected, { provinceCode: 88, districtCode: 8801, subdistrictCode: 880101 });
});

test("postal lookup auto-selection survives a late initialization response", async () => {
  let resolveNames: ((value: { ok: true; data: { provinceCode: number; districtCode: number; subdistrictCode: number } }) => void) | undefined;
  const versions = createThaiAddressRequestVersions();
  const initialization = createThaiContactAddressInitializationController(versions);
  const postalLookup = createThaiContactAddressPostalLookupController(versions, initialization);
  const selected = { provinceCode: null as number | null, districtCode: null as number | null, subdistrictCode: null as number | null };
  const pendingInitialization = initialization.start({
    applyProvinces: () => undefined,
    applyResolved: (value) => Object.assign(selected, value),
    isActive: () => true,
    listProvinces: async () => ({ ok: true as const, data: [] }),
    resolveNames: () => new Promise((resolve) => { resolveNames = resolve; }),
  });

  await postalLookup.updatePostalCode("20110", {
    chooseDistrict: (option) => { initialization.userChanged(); selected.districtCode = option.code; selected.subdistrictCode = null; },
    chooseProvince: (option) => { initialization.userChanged(); selected.provinceCode = option.code; selected.districtCode = null; selected.subdistrictCode = null; },
    listDistricts: async () => ({ ok: true as const, data: [{ code: 2007, nameTh: "ศรีราชา" }] }),
    lookupPostalCode: async () => ({ ok: true as const, data: { candidates: [{ province: { code: 20, nameTh: "ชลบุรี" }, district: { code: 2007, nameTh: "ศรีราชา" }, subdistrict: { code: 200701, nameTh: "สุรศักดิ์" }, postalCode: "20110" }] } }),
    onPostalCode: () => undefined,
    setCandidates: () => undefined,
    setMessage: () => undefined,
  });
  resolveNames?.({ ok: true, data: { provinceCode: 88, districtCode: 8801, subdistrictCode: 880101 } });
  await pendingInitialization;

  assert.deepEqual(selected, { provinceCode: 20, districtCode: 2007, subdistrictCode: null });
});

test("postal lookup selects its unique district even when the province list contains other districts", async () => {
  const versions = createThaiAddressRequestVersions();
  const initialization = createThaiContactAddressInitializationController(versions);
  const postalLookup = createThaiContactAddressPostalLookupController(versions, initialization);
  const selected = { provinceCode: null as number | null, districtCode: null as number | null };

  await postalLookup.updatePostalCode("20110", {
    chooseDistrict: (option) => { selected.districtCode = option.code; },
    chooseProvince: (option) => { selected.provinceCode = option.code; },
    listDistricts: async () => ({ ok: true as const, data: [{ code: 2007, nameTh: "ศรีราชา" }, { code: 2004, nameTh: "บางละมุง" }] }),
    lookupPostalCode: async () => ({ ok: true as const, data: { candidates: [
      { province: { code: 20, nameTh: "ชลบุรี" }, district: { code: 2007, nameTh: "ศรีราชา" }, subdistrict: { code: 200701, nameTh: "ศรีราชา" }, postalCode: "20110" },
      { province: { code: 20, nameTh: "ชลบุรี" }, district: { code: 2007, nameTh: "ศรีราชา" }, subdistrict: { code: 200702, nameTh: "สุรศักดิ์" }, postalCode: "20110" },
    ] } }),
    onPostalCode: () => undefined,
    setCandidates: () => undefined,
    setMessage: () => undefined,
  });

  assert.deepEqual(selected, { provinceCode: 20, districtCode: 2007 });
});

test("manual province, district, and uniquely-postcoded subdistrict selection synchronizes the postal code", () => {
  const selected = { provinceCode: null as number | null, districtCode: null as number | null, subdistrictCode: null as number | null };
  const patches: Array<Record<string, string | null>> = [];
  const controller = createThaiContactAddressSelectionController({
    onChange: (patch) => patches.push(patch),
    setDistrictCode: (code) => { selected.districtCode = code; },
    setProvinceCode: (code) => { selected.provinceCode = code; },
    setSubdistrictCode: (code) => { selected.subdistrictCode = code; },
  });

  controller.chooseProvince({ code: 20, nameTh: "ชลบุรี" });
  controller.chooseDistrict({ code: 2007, nameTh: "ศรีราชา" });
  controller.chooseSubdistrict({ code: 200701, nameTh: "สุรศักดิ์", postalCodes: ["20110"] });

  assert.deepEqual(selected, { provinceCode: 20, districtCode: 2007, subdistrictCode: 200701 });
  assert.deepEqual(patches, [
    { province: "ชลบุรี", district: null, sub_district: null },
    { district: "ศรีราชา", sub_district: null },
    { sub_district: "สุรศักดิ์", postal_code: "20110" },
  ]);
});

test("contact address puts manual detail and country before postal geography", () => {
  const source = readFileSync(componentUrl, "utf8");

  assert.ok(source.indexOf('label="ที่อยู่"') < source.indexOf('label="ประเทศ"'));
  assert.ok(source.indexOf('label="ประเทศ"') < source.indexOf('label="รหัสไปรษณีย์"'));
  assert.ok(source.indexOf('label="รหัสไปรษณีย์"') < source.indexOf('label="จังหวัด"'));
  assert.ok(source.indexOf('label="จังหวัด"') < source.indexOf('label="อำเภอ / เขต"'));
  assert.ok(source.indexOf('label="อำเภอ / เขต"') < source.indexOf('label="ตำบล / แขวง"'));
});

test("contact address supports searchable cascading manual choices without locking postcode", () => {
  const source = readFileSync(componentUrl, "utf8");

  assert.match(source, /itemToStringLabel=\{\(option: ThaiAddressOption\) => option\.nameTh\}/);
  assert.match(source, /ComboboxInput[\s\S]*placeholder="ค้นหาจังหวัด/);
  assert.match(source, /ComboboxInput[\s\S]*placeholder="ค้นหาอำเภอ/);
  assert.match(source, /ComboboxInput[\s\S]*placeholder="เลือกหรือค้นหาตำบล/);
  assert.match(source, /ComboboxContent container=\{portalContainer\}/);
  assert.match(source, /disabled=\{disabled \|\| provinceCode === null\}/);
  assert.match(source, /disabled=\{disabled \|\| districtCode === null\}/);
  assert.match(source, /type="tel" inputMode="numeric" maxLength=\{5\}/);
  assert.match(source, /createThaiContactAddressSelectionController/);
  assert.match(source, /createThaiAddressRequestVersions/);
  assert.doesNotMatch(source, /requestToken/);
  assert.match(source, /createThaiContactAddressInitializationController/);
  assert.match(source, /function chooseProvince[\s\S]*initialization\.userChanged/);
  assert.match(source, /function chooseDistrict[\s\S]*initialization\.userChanged/);
  assert.match(source, /function chooseSubdistrict[\s\S]*initialization\.userChanged/);
  assert.match(source, /function updatePostalCode[\s\S]*postalLookup\.updatePostalCode/);
});

test("customer picker places its popup within the modal sheet", () => {
  const source = readFileSync(comboboxUrl, "utf8");
  const customerPicker = readFileSync(customerPickerUrl, "utf8");

  assert.match(source, /Pick<ComboboxPrimitive\.Portal\.Props, "container">/);
  assert.match(source, /<ComboboxPrimitive\.Portal container=\{container\}>/);
  assert.match(customerPicker, /<ComboboxContent container=\{portalContainer\}>/);
});

test("a postal lookup derives its district choice from the returned candidates", () => {
  const source = readFileSync(postalControllerUrl, "utf8");

  assert.match(source, /request\.listDistricts\(provinces\[0\]\.code, postalCode\)/);
  assert.match(source, /candidate\.district\.code/);
  assert.match(source, /districts\.length === 1/);
});

test("booking form mounts the address component only for contact address fields", () => {
  const form = readFileSync(formUrl, "utf8");
  const component = readFileSync(componentUrl, "utf8");

  assert.doesNotMatch(form, /\[&_input\]:bg-background/);
  assert.match(form, /group\.key === "address"[\s\S]*<ThaiContactAddressFields/);
  assert.match(form, /CUSTOMER_FIELDS\.filter\(field => field\.group === group\.key[\s\S]*field\.key !== "address"[\s\S]*field\.key !== "sub_district"/);
  assert.match(form, /tax_address/);
  assert.match(form, /<Textarea/);
  assert.doesNotMatch(component, /tax_address/);
});
