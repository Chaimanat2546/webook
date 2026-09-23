import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { createThaiAddressRequestVersions } from "../components/admin/houses/bookings/thai-contact-address-request-versions.ts";
import { createThaiContactAddressInitializationController } from "../components/admin/houses/bookings/thai-contact-address-initialization.ts";

const componentUrl = new URL("../components/admin/houses/bookings/thai-contact-address-fields.tsx", import.meta.url);
const formUrl = new URL("../components/admin/houses/bookings/booking-customer-form.tsx", import.meta.url);

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

  assert.match(source, /ComboboxInput[\s\S]*placeholder="ค้นหาจังหวัด/);
  assert.match(source, /ComboboxInput[\s\S]*placeholder="ค้นหาอำเภอ/);
  assert.match(source, /ComboboxInput[\s\S]*placeholder="ค้นหาตำบล/);
  assert.match(source, /disabled=\{disabled \|\| provinceCode === null\}/);
  assert.match(source, /disabled=\{disabled \|\| districtCode === null\}/);
  assert.match(source, /type="tel" inputMode="numeric" maxLength=\{5\}/);
  assert.match(source, /setDistrictCode\(null\)[\s\S]*setSubdistrictCode\(null\)[\s\S]*district: null, sub_district: null/);
  assert.match(source, /createThaiAddressRequestVersions/);
  assert.doesNotMatch(source, /requestToken/);
  assert.match(source, /createThaiContactAddressInitializationController/);
  assert.match(source, /function chooseProvince[\s\S]*initialization\.userChanged/);
  assert.match(source, /function chooseDistrict[\s\S]*initialization\.userChanged/);
  assert.match(source, /function chooseSubdistrict[\s\S]*initialization\.userChanged/);
  assert.match(source, /function updatePostalCode[\s\S]*initialization\.userChanged[\s\S]*postalCode\.length !== 5/);
});

test("a uniquely narrowed postal lookup can suggest its district without forcing ambiguous choices", () => {
  const source = readFileSync(componentUrl, "utf8");

  assert.match(source, /listThaiDistrictsAction\(propertyId, provinces\[0\]\.code, postalCode\)/);
  assert.match(source, /districtResult\.data\.length === 1/);
});

test("booking form mounts the address component only for contact address fields", () => {
  const form = readFileSync(formUrl, "utf8");
  const component = readFileSync(componentUrl, "utf8");

  assert.match(form, /group\.key === "address"[\s\S]*<ThaiContactAddressFields/);
  assert.match(form, /CUSTOMER_FIELDS\.filter\(field => field\.group === group\.key[\s\S]*field\.key !== "address"[\s\S]*field\.key !== "sub_district"/);
  assert.match(form, /tax_address/);
  assert.match(form, /<Textarea/);
  assert.doesNotMatch(component, /tax_address/);
});
