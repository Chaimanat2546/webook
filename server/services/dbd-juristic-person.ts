import "server-only";

import type { DbdCustomerDefaults } from "../../lib/quotation-customer-types.ts";

const DBD_URL = "https://openapi.dbd.go.th/api/v1/juristic_person";
const TAX_ID = /^[0-9]{13}$/;

export type DbdLookupResult =
  | { defaults: DbdCustomerDefaults; ok: true }
  | { ok: false; reason: "not_found" | "unavailable" };

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
): Promise<DbdLookupResult> {
  if (!TAX_ID.test(taxId)) return { ok: false, reason: "not_found" };

  try {
    const response = await fetchImpl(`${DBD_URL}/${encodeURIComponent(taxId)}`, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return { ok: false, reason: "unavailable" };

    const root = objectValue(await response.json());
    if (!root) return { ok: false, reason: "unavailable" };
    const status = objectValue(root.status);
    if (textValue(status?.code) !== "1000") return { ok: false, reason: "not_found" };
    if (!Array.isArray(root.data) || root.data.length === 0) {
      return { ok: false, reason: "not_found" };
    }

    const row = objectValue(root.data[0]);
    const juristicPerson = row && objectValue(row["cd:OrganizationJuristicPerson"]);
    const addressContainer = juristicPerson
      ? objectValue(juristicPerson["cd:OrganizationJuristicAddress"])
      : null;
    const addressType = addressContainer && objectValue(addressContainer["cr:AddressType"]);
    if (!juristicPerson || !addressType) return { ok: false, reason: "unavailable" };

    const returnedTaxId = textValue(juristicPerson["cd:OrganizationJuristicID"]);
    const name = textValue(juristicPerson["cd:OrganizationJuristicNameTH"]);
    const statusText = textValue(juristicPerson["cd:OrganizationJuristicStatus"]);
    const address = composeAddress(addressType);
    if (returnedTaxId !== taxId || !name || !statusText || !address) {
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
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
