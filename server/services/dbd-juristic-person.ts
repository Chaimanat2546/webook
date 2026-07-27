import "server-only";

import type { DbdCustomerDefaults } from "../../lib/quotation-customer-types.ts";

const DBD_URL = "https://openapi.dbd.go.th/api/v1/juristic_person";
const TAX_ID = /^[0-9]{13}$/;

export type DbdLookupResult =
  | { defaults: DbdCustomerDefaults; ok: true }
  | { ok: false; reason: "not_found" | "unavailable" };

type DbdDiagnostic = {
  contentType: string;
  elapsedMs: number;
  httpStatus: number;
  outcome: "http_error" | "invalid_response" | "network_error" | "timeout";
  stage: "parse" | "request" | "response" | "schema";
};

type DbdDiagnosticLogger = (diagnostic: DbdDiagnostic) => void;

function logDbdDiagnostic(diagnostic: DbdDiagnostic): void {
  console.warn("dbd_lookup_failed", diagnostic);
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nestedText(source: Record<string, unknown>, key: string, textKey: string): string {
  const nested = objectValue(source[key]);
  return nested ? textValue(nested[textKey]) : "";
}

function withoutPrefix(value: string, prefixes: readonly string[]): string {
  const prefix = prefixes.find((candidate) => value.startsWith(candidate));
  return prefix ? value.slice(prefix.length).trim() : value;
}

function composeAddress(source: Record<string, unknown>): string {
  const address = textValue(source["cd:Address"]);
  const subdistrict = nestedText(source, "cd:CitySubDivision", "cr:CitySubDivisionTextTH");
  const district = nestedText(source, "cd:City", "cr:CityTextTH");
  const province = nestedText(source, "cd:CountrySubDivision", "cr:CountrySubDivisionTextTH");
  const bangkok = province === "กรุงเทพมหานคร";
  return [
    address,
    subdistrict && `${bangkok ? "แขวง" : "ตำบล"}${withoutPrefix(subdistrict, ["แขวง", "ตำบล"])}`,
    district && `${bangkok ? "เขต" : "อำเภอ"}${withoutPrefix(district, ["เขต", "อำเภอ"])}`,
    province,
  ].filter(Boolean).join(" ");
}

export async function lookupDbdJuristicPerson(
  taxId: string,
  fetchImpl: typeof fetch = fetch,
  diagnosticLogger: DbdDiagnosticLogger = logDbdDiagnostic,
): Promise<DbdLookupResult> {
  if (!TAX_ID.test(taxId)) return { ok: false, reason: "not_found" };

  const startedAt = Date.now();
  const diagnose = (
    diagnostic: Omit<DbdDiagnostic, "elapsedMs">,
  ): void => {
    try {
      diagnosticLogger({ ...diagnostic, elapsedMs: Date.now() - startedAt });
    } catch {
      // Diagnostics must never change the lookup result.
    }
  };
  try {
    const response = await fetchImpl(`${DBD_URL}/${encodeURIComponent(taxId)}`, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      diagnose({
        contentType: response.headers.get("content-type") ?? "",
        httpStatus: response.status,
        outcome: "http_error",
        stage: "response",
      });
      return { ok: false, reason: "unavailable" };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      diagnose({
        contentType: response.headers.get("content-type") ?? "",
        httpStatus: response.status,
        outcome: "invalid_response",
        stage: "parse",
      });
      return { ok: false, reason: "unavailable" };
    }

    const root = objectValue(body);
    if (!root) {
      diagnose({
        contentType: response.headers.get("content-type") ?? "",
        httpStatus: response.status,
        outcome: "invalid_response",
        stage: "schema",
      });
      return { ok: false, reason: "unavailable" };
    }
    const status = objectValue(root.status);
    const statusCode = textValue(status?.code);
    if (!status || !statusCode) {
      diagnose({
        contentType: response.headers.get("content-type") ?? "",
        httpStatus: response.status,
        outcome: "invalid_response",
        stage: "schema",
      });
      return { ok: false, reason: "unavailable" };
    }
    if (statusCode !== "1000") return { ok: false, reason: "not_found" };
    if (!Array.isArray(root.data)) {
      diagnose({
        contentType: response.headers.get("content-type") ?? "",
        httpStatus: response.status,
        outcome: "invalid_response",
        stage: "schema",
      });
      return { ok: false, reason: "unavailable" };
    }
    if (root.data.length === 0) {
      return { ok: false, reason: "not_found" };
    }

    const row = objectValue(root.data[0]);
    const juristicPerson = row && objectValue(row["cd:OrganizationJuristicPerson"]);
    const addressContainer = juristicPerson
      ? objectValue(juristicPerson["cd:OrganizationJuristicAddress"])
      : null;
    const addressType = addressContainer && objectValue(addressContainer["cr:AddressType"]);
    if (!juristicPerson || !addressType) {
      diagnose({
        contentType: response.headers.get("content-type") ?? "",
        httpStatus: response.status,
        outcome: "invalid_response",
        stage: "schema",
      });
      return { ok: false, reason: "unavailable" };
    }

    const returnedTaxId = textValue(juristicPerson["cd:OrganizationJuristicID"]);
    const name = textValue(juristicPerson["cd:OrganizationJuristicNameTH"]);
    const statusText = textValue(juristicPerson["cd:OrganizationJuristicStatus"]);
    const address = composeAddress(addressType);
    if (returnedTaxId !== taxId || !name || !statusText || !address) {
      diagnose({
        contentType: response.headers.get("content-type") ?? "",
        httpStatus: response.status,
        outcome: "invalid_response",
        stage: "schema",
      });
      return { ok: false, reason: "unavailable" };
    }

    return {
      defaults: {
        address,
        name,
        status: statusText,
        taxId: returnedTaxId,
        verifiedAt: new Date().toISOString(),
      },
      ok: true,
    };
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "";
    diagnose({
      contentType: "",
      httpStatus: 0,
      outcome: errorName === "AbortError" || errorName === "TimeoutError"
        ? "timeout"
        : "network_error",
      stage: "request",
    });
    return { ok: false, reason: "unavailable" };
  }
}
