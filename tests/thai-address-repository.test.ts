import assert from "node:assert/strict";
import { test } from "node:test";
import { createThaiAddressRepository } from "../server/geography/thai-address-repository.ts";

const fixture = {
  provinces: [
    { code: 20, nameTh: "ชลบุรี" },
    { code: 21, nameTh: "ระยอง" },
  ],
  districtsByProvince: {
    20: [
      { code: 2003, nameTh: "เมืองชลบุรี", provinceCode: 20, postalCodes: ["20000"] },
      { code: 2007, nameTh: "ศรีราชา", provinceCode: 20, postalCodes: ["20110"] },
      { code: 2008, nameTh: "หนองใหญ่", provinceCode: 20, postalCodes: ["20110", "20200"] },
    ],
    21: [{ code: 2101, nameTh: "เมืองระยอง", provinceCode: 21, postalCodes: ["20110"] }],
  },
  subdistrictsByDistrict: {
    2003: [{ code: 200301, nameTh: "บางปลาสร้อย", provinceCode: 20, districtCode: 2003, postalCodes: ["20000"] }],
    2007: [{ code: 200701, nameTh: "สุรศักดิ์", provinceCode: 20, districtCode: 2007, postalCodes: ["20110"] }],
    2008: [{ code: 200801, nameTh: "ห้างสูง", provinceCode: 20, districtCode: 2008, postalCodes: ["20110", "20200"] }],
    2101: [{ code: 210101, nameTh: "ท่าประดู่", provinceCode: 21, districtCode: 2101, postalCodes: ["20110"] }],
  },
  candidatesByPostalCode: {
    "20000": [{ province: { code: 20, nameTh: "ชลบุรี" }, district: { code: 2003, nameTh: "เมืองชลบุรี" }, subdistrict: { code: 200301, nameTh: "บางปลาสร้อย" }, postalCode: "20000" }],
    "20110": [
      { province: { code: 21, nameTh: "ระยอง" }, district: { code: 2101, nameTh: "เมืองระยอง" }, subdistrict: { code: 210101, nameTh: "ท่าประดู่" }, postalCode: "20110" },
      { province: { code: 20, nameTh: "ชลบุรี" }, district: { code: 2003, nameTh: "เมืองชลบุรี" }, subdistrict: { code: 200301, nameTh: "บางปลาสร้อย" }, postalCode: "20110" },
      { province: { code: 20, nameTh: "ชลบุรี" }, district: { code: 2007, nameTh: "ศรีราชา" }, subdistrict: { code: 200701, nameTh: "สุรศักดิ์" }, postalCode: "20110" },
    ],
  },
};

test("postal candidates preserve ambiguity", () => {
  const repository = createThaiAddressRepository(fixture);

  assert.deepEqual(repository.postalCandidates("20110").map((row) => row.province.nameTh), ["ชลบุรี", "ชลบุรี", "ระยอง"]);
});

test("hierarchical options prefer the postcode", () => {
  const repository = createThaiAddressRepository(fixture);

  assert.deepEqual(repository.districts(20, "20110").map((row) => row.nameTh), ["ศรีราชา", "หนองใหญ่", "เมืองชลบุรี"]);
  assert.deepEqual(repository.subdistricts(2007, "20110").map((row) => row.nameTh), ["สุรศักดิ์"]);
  assert.deepEqual(repository.provinces("20110").map((row) => row.nameTh), ["ชลบุรี", "ระยอง"]);
});

test("name resolution is scoped to resolved parents and leaves unknown names unresolved", () => {
  const repository = createThaiAddressRepository(fixture);

  assert.deepEqual(repository.resolveNames({ province: "ชลบุรี", district: "เมืองระยอง", subdistrict: "ท่าประดู่" }), {
    provinceCode: 20,
    districtCode: null,
    subdistrictCode: null,
  });
  assert.deepEqual(repository.resolveNames({ province: "ชื่อเดิม", district: "", subdistrict: "" }), {
    provinceCode: null,
    districtCode: null,
    subdistrictCode: null,
  });
});

test("postcode ordering retains a district with multiple postcodes", () => {
  const repository = createThaiAddressRepository(fixture);

  assert.ok(repository.districts(20, "20110").some((row) => row.code === 2008));
  assert.ok(repository.districts(20, "20200").some((row) => row.code === 2008));
});
