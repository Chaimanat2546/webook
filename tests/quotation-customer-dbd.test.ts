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
      new Response("not-json", { status: 200 }), () => undefined);
    assert.deepEqual(invalid, { ok: false, reason: "unavailable" });
    const failed = await lookupDbdJuristicPerson("0107544000108", async () =>
      new Response("", { status: 503 }), () => undefined);
    assert.deepEqual(failed, { ok: false, reason: "unavailable" });
    const aborted = await lookupDbdJuristicPerson("0107544000108", async () => {
      throw new DOMException("Aborted", "AbortError");
    }, () => undefined);
    assert.deepEqual(aborted, { ok: false, reason: "unavailable" });
  });

  it("logs safe upstream diagnostics without exposing the tax ID or response body", async () => {
    const diagnostics: unknown[] = [];
    const result = await lookupDbdJuristicPerson(
      "0107544000108",
      async () => new Response("sensitive upstream body", {
        headers: { "content-type": "text/html" },
        status: 403,
      }),
      (diagnostic) => diagnostics.push(diagnostic),
    );

    assert.deepEqual(result, { ok: false, reason: "unavailable" });
    assert.equal(diagnostics.length, 1);
    const diagnostic = diagnostics[0] as Record<string, unknown>;
    assert.equal(typeof diagnostic.elapsedMs, "number");
    assert.deepEqual({ ...diagnostic, elapsedMs: undefined }, {
      contentType: "text/html",
      elapsedMs: undefined,
      httpStatus: 403,
      outcome: "http_error",
      stage: "response",
    });
    const serialized = JSON.stringify(diagnostics);
    assert.doesNotMatch(serialized, /0107544000108|sensitive upstream body/);
  });

  it("distinguishes invalid JSON from a request timeout in safe diagnostics", async () => {
    const invalidJsonDiagnostics: unknown[] = [];
    const invalidJson = await lookupDbdJuristicPerson(
      "0107544000108",
      async () => new Response("sensitive invalid JSON", {
        headers: { "content-type": "text/html" },
        status: 200,
      }),
      (diagnostic) => invalidJsonDiagnostics.push(diagnostic),
    );
    assert.deepEqual(invalidJson, { ok: false, reason: "unavailable" });
    assert.deepEqual(
      { ...(invalidJsonDiagnostics[0] as Record<string, unknown>), elapsedMs: undefined },
      {
        contentType: "text/html",
        elapsedMs: undefined,
        httpStatus: 200,
        outcome: "invalid_response",
        stage: "parse",
      },
    );

    const timeoutDiagnostics: unknown[] = [];
    const timeout = await lookupDbdJuristicPerson(
      "0107544000108",
      async () => {
        throw new DOMException("sensitive timeout detail", "AbortError");
      },
      (diagnostic) => timeoutDiagnostics.push(diagnostic),
    );
    assert.deepEqual(timeout, { ok: false, reason: "unavailable" });
    assert.deepEqual(
      { ...(timeoutDiagnostics[0] as Record<string, unknown>), elapsedMs: undefined },
      {
        contentType: "",
        elapsedMs: undefined,
        httpStatus: 0,
        outcome: "timeout",
        stage: "request",
      },
    );

    const serialized = JSON.stringify([invalidJsonDiagnostics, timeoutDiagnostics]);
    assert.doesNotMatch(serialized, /0107544000108|sensitive invalid JSON|sensitive timeout detail/);
  });

  it("treats malformed status and success data shapes as schema failures", async () => {
    for (const body of [{}, { status: { code: "1000" }, data: {} }]) {
      const diagnostics: unknown[] = [];
      const result = await lookupDbdJuristicPerson(
        "0107544000108",
        async () => Response.json(body),
        (diagnostic) => diagnostics.push(diagnostic),
      );

      assert.deepEqual(result, { ok: false, reason: "unavailable" });
      assert.deepEqual(
        { ...(diagnostics[0] as Record<string, unknown>), elapsedMs: undefined },
        {
          contentType: "application/json",
          elapsedMs: undefined,
          httpStatus: 200,
          outcome: "invalid_response",
          stage: "schema",
        },
      );
    }
  });
});
