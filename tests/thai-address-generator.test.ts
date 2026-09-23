import assert from "node:assert/strict";
import { test } from "node:test";
import { generateThaiAddressData } from "../scripts/generate-thai-address-data.mjs";

const geo = [{
  code: 20,
  name_th: "ชลบุรี",
  districts: [{
    code: 2007,
    name_th: "ศรีราชา",
    subdistricts: [{ code: 200701, name_th: "สุรศักดิ์", postal_code: 20110 }],
  }],
}];

const address = {
  province_code: 20,
  province_name_th: "ชลบุรี",
  district_code: 2007,
  district_name_th: "ศรีราชา",
  subdistrict_code: 200701,
  subdistrict_name_th: "สุรศักดิ์",
};

test("generator preserves every postcode for a subdistrict so it cannot signal a unique autofill", () => {
  const data = generateThaiAddressData({
    geo,
    postalLookup: {
      "20110": { postal_code: 20110, addresses: [address] },
      "20200": { postal_code: 20200, addresses: [address] },
    },
  });

  const subdistrictsByDistrict = data.subdistrictsByDistrict as Record<number, Array<{ postalCodes: string[] }>>;
  const subdistrict = subdistrictsByDistrict[2007][0];
  assert.deepEqual(subdistrict.postalCodes, ["20110", "20200"]);
  assert.equal(new Set(subdistrict.postalCodes).size, 2);
  assert.deepEqual(Object.keys(data.candidatesByPostalCode), ["20110", "20200"]);
});

test("generator rejects malformed and hierarchy-mismatched postal lookup addresses", () => {
  assert.throws(() => generateThaiAddressData({
    geo,
    postalLookup: { "20110": { postal_code: 20110, addresses: [{ ...address, district_name_th: 123 }] } },
  }), /Invalid postal lookup address/);

  assert.throws(() => generateThaiAddressData({
    geo,
    postalLookup: { "20110": { postal_code: 20110, addresses: [{ ...address, subdistrict_code: 200702 }] } },
  }), /does not match Geo hierarchy/);
});
