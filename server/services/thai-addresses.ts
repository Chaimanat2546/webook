import "server-only";

import type { ThaiAddressRepository } from "../geography/thai-address-types.ts";

function optionalPostalCode(value: unknown): string | undefined {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return undefined;
  if (!/^\d{5}$/.test(normalized)) throw new Error("รหัสไปรษณีย์ต้องมี 5 หลัก");
  return normalized;
}

function requiredPostalCode(value: unknown): string {
  const normalized = optionalPostalCode(value);
  if (!normalized) throw new Error("รหัสไปรษณีย์ต้องมี 5 หลัก");
  return normalized;
}

function positiveInteger(value: unknown, message: string): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(message);
  return parsed;
}

function nullableName(value: unknown, message: string): string | null {
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new Error(message);
  return value.trim() || null;
}

export function lookupThaiPostalCode(repository: ThaiAddressRepository, rawPostalCode: unknown) {
  const normalizedPostalCode = requiredPostalCode(rawPostalCode);
  return { postalCode: normalizedPostalCode, candidates: repository.postalCandidates(normalizedPostalCode) };
}

export function listThaiProvinces(repository: ThaiAddressRepository, rawPostalCode: unknown) {
  return repository.provinces(optionalPostalCode(rawPostalCode));
}

export function listThaiDistricts(repository: ThaiAddressRepository, rawProvinceCode: unknown, rawPostalCode: unknown) {
  return repository.districts(positiveInteger(rawProvinceCode, "จังหวัดไม่ถูกต้อง"), optionalPostalCode(rawPostalCode));
}

export function listThaiSubdistricts(repository: ThaiAddressRepository, rawDistrictCode: unknown, rawPostalCode: unknown) {
  return repository.subdistricts(positiveInteger(rawDistrictCode, "อำเภอไม่ถูกต้อง"), optionalPostalCode(rawPostalCode));
}

export function resolveThaiAddressNames(repository: ThaiAddressRepository, rawValue: unknown) {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) throw new Error("ข้อมูลที่อยู่ไม่ถูกต้อง");
  const value = rawValue as Record<string, unknown>;
  return repository.resolveNames({
    province: nullableName(value.province, "จังหวัดไม่ถูกต้อง"),
    district: nullableName(value.district, "อำเภอไม่ถูกต้อง"),
    subdistrict: nullableName(value.subdistrict, "ตำบลไม่ถูกต้อง"),
  });
}
