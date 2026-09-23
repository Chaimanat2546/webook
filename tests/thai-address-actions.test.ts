import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  listThaiDistricts,
  listThaiProvinces,
  listThaiSubdistricts,
  lookupThaiPostalCode,
  resolveThaiAddressNames,
} from "../server/services/thai-addresses.ts";
import type { ThaiAddressRepository } from "../server/geography/thai-address-types.ts";

function repositoryFixture(): ThaiAddressRepository {
  return {
    postalCandidates(postalCode) {
      return postalCode === "20110" ? [{
        province: { code: 20, nameTh: "ชลบุรี" },
        district: { code: 2007, nameTh: "ศรีราชา" },
        subdistrict: { code: 200701, nameTh: "สุรศักดิ์" },
        postalCode,
      }] : [];
    },
    provinces(postalCode) { return postalCode ? [{ code: 20, nameTh: "ชลบุรี" }] : [{ code: 10, nameTh: "กรุงเทพมหานคร" }]; },
    districts(provinceCode, postalCode) { return [{ code: provinceCode * 100 + 7, nameTh: postalCode === "20110" ? "ศรีราชา" : "เมืองชลบุรี" }]; },
    subdistricts(districtCode, postalCode) { return [{ code: districtCode * 100 + 1, nameTh: postalCode === "20110" ? "สุรศักดิ์" : "บางปลาสร้อย" }]; },
    resolveNames(value) {
      return value.province === "ชลบุรี"
        ? { provinceCode: 20, districtCode: value.district === "ศรีราชา" ? 2007 : null, subdistrictCode: value.subdistrict === "สุรศักดิ์" ? 200701 : null }
        : { provinceCode: null, districtCode: null, subdistrictCode: null };
    },
  };
}

test("postal lookup accepts exactly five ASCII digits and returns candidates", () => {
  const repository = repositoryFixture();

  assert.throws(() => lookupThaiPostalCode(repository, "2011"), /รหัสไปรษณีย์ต้องมี 5 หลัก/);
  assert.throws(() => lookupThaiPostalCode(repository, "๒๐๑๑๐"), /รหัสไปรษณีย์ต้องมี 5 หลัก/);
  assert.deepEqual(lookupThaiPostalCode(repository, " 20110 "), {
    postalCode: "20110",
    candidates: [{
      province: { code: 20, nameTh: "ชลบุรี" },
      district: { code: 2007, nameTh: "ศรีราชา" },
      subdistrict: { code: 200701, nameTh: "สุรศักดิ์" },
      postalCode: "20110",
    }],
  });
});

test("hierarchical lookups validate codes before reaching the repository", () => {
  const calls: string[] = [];
  const repository = { ...repositoryFixture(), districts: () => { calls.push("districts"); return []; }, subdistricts: () => { calls.push("subdistricts"); return []; } };

  assert.throws(() => listThaiDistricts(repository, "twenty", null), /จังหวัดไม่ถูกต้อง/);
  assert.throws(() => listThaiSubdistricts(repository, 0, null), /อำเภอไม่ถูกต้อง/);
  assert.deepEqual(calls, []);
});

test("optional postcodes are either blank or exactly five digits", () => {
  const repository = repositoryFixture();

  assert.deepEqual(listThaiProvinces(repository, ""), [{ code: 10, nameTh: "กรุงเทพมหานคร" }]);
  assert.deepEqual(listThaiDistricts(repository, "20", "20110"), [{ code: 2007, nameTh: "ศรีราชา" }]);
  for (const invalidPostalCode of ["2011", null, 20110, {}]) {
    assert.throws(() => listThaiProvinces(repository, invalidPostalCode), /รหัสไปรษณีย์ต้องมี 5 หลัก/);
  }
});

test("name resolution passes only nullable names to the repository", () => {
  const repository = repositoryFixture();

  assert.deepEqual(resolveThaiAddressNames(repository, { province: "ชลบุรี", district: "ศรีราชา", subdistrict: "สุรศักดิ์" }), {
    provinceCode: 20,
    districtCode: 2007,
    subdistrictCode: 200701,
  });
  assert.throws(() => resolveThaiAddressNames(repository, { province: 20, district: null, subdistrict: null }), /จังหวัดไม่ถูกต้อง/);
});

test("lookup actions guard a house after authenticating and call only the geography service", () => {
  const source = readFileSync(new URL("../app/admin/houses/[propertyId]/bookings/actions.ts", import.meta.url), "utf8");

  const actions = {
    lookupThaiPostalCodeAction: "lookupThaiPostalCode",
    listThaiProvincesAction: "listThaiProvinces",
    listThaiDistrictsAction: "listThaiDistricts",
    listThaiSubdistrictsAction: "listThaiSubdistricts",
    resolveThaiAddressNamesAction: "resolveThaiAddressNames",
  } as const;

  for (const [action, service] of Object.entries(actions)) {
    const start = source.indexOf(`export async function ${action}`);
    const end = source.indexOf("\nexport async function", start + 1);
    const body = source.slice(start, end === -1 ? undefined : end);
    assert.ok(start >= 0, `${action} is exported`);
    const bookingResultPosition = body.indexOf("bookingResult(async () =>");
    const adminPosition = body.indexOf("requireBookingAdmin()");
    const housePosition = body.indexOf("requireBookingHouse(repository, propertyId)");
    const servicePosition = body.indexOf(`${service}(thaiAddressRepository`);
    assert.ok(bookingResultPosition >= 0, `${action} wraps the result safely`);
    assert.ok(bookingResultPosition < adminPosition && adminPosition < housePosition && housePosition < servicePosition, `${action} authenticates, guards the house, then delegates to ${service}`);
  }
});
