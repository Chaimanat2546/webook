import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { lookupDbdJuristicPerson } from "../server/services/dbd-juristic-person.ts";

const successBody = {
  status: { code: "1000", description: "Success" },
  data: [{
    "cd:OrganizationJuristicPerson": {
      "cd:OrganizationJuristicAddress": {
        "cr:AddressType": {
          "cd:Address": "99 ถนนสุขุมวิท",
          "cd:CitySubDivision": { "cr:CitySubDivisionTextTH": "คลองตันเหนือ" },
          "cd:City": { "cr:CityTextTH": "เขตวัฒนา" },
          "cd:CountrySubDivision": { "cr:CountrySubDivisionTextTH": "กรุงเทพมหานคร" },
        },
      },
      "cd:OrganizationJuristicID": "0107544000108",
      "cd:OrganizationJuristicNameTH": "บริษัท ตัวอย่าง จำกัด",
      "cd:OrganizationJuristicStatus": "ยังดำเนินกิจการอยู่",
    },
  }],
};

describe("DBD juristic lookup", () => {
  it("maps namespaced fields and composes a null-safe address", async () => {
    const result = await lookupDbdJuristicPerson("0107544000108", async () =>
      new Response(JSON.stringify(successBody), { status: 200 }));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.defaults, {
      address: "99 ถนนสุขุมวิท แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพมหานคร",
      name: "บริษัท ตัวอย่าง จำกัด",
      status: "ยังดำเนินกิจการอยู่",
      taxId: "0107544000108",
      verifiedAt: result.defaults.verifiedAt,
    });
    assert.match(result.defaults.verifiedAt, /^\d{4}-\d{2}-\d{2}T/);
  });

  it("maps non-1000, non-JSON, HTTP failure, and abort to safe reasons", async () => {
    const notFound = await lookupDbdJuristicPerson("0107544000108", async () =>
      new Response(JSON.stringify({ status: { code: "1001" }, data: [] })));
    assert.deepEqual(notFound, { ok: false, reason: "not_found" });
    const invalid = await lookupDbdJuristicPerson("0107544000108", async () =>
      new Response("not-json", { status: 200 }));
    assert.deepEqual(invalid, { ok: false, reason: "unavailable" });
    const failed = await lookupDbdJuristicPerson("0107544000108", async () =>
      new Response("", { status: 503 }));
    assert.deepEqual(failed, { ok: false, reason: "unavailable" });
    const aborted = await lookupDbdJuristicPerson("0107544000108", async () => {
      throw new DOMException("Aborted", "AbortError");
    });
    assert.deepEqual(aborted, { ok: false, reason: "unavailable" });
  });
});
