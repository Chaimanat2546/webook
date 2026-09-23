import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { createThaiAddressRequestVersions } from "../components/admin/houses/bookings/thai-contact-address-request-versions.ts";

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

  versions.invalidatePostal();
  assert.equal(versions.isPostalCurrent(postal), false);
  assert.equal(versions.isDistrictsCurrent(districts), true);
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
  assert.match(source, /function chooseProvince[\s\S]*invalidatePostal/);
  assert.match(source, /function chooseDistrict[\s\S]*invalidatePostal/);
  assert.match(source, /function chooseSubdistrict[\s\S]*invalidatePostal/);
  assert.match(source, /function updatePostalCode[\s\S]*invalidatePostal[\s\S]*postalCode\.length !== 5/);
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
