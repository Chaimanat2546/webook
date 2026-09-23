import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sourceDirectory = path.join(process.cwd(), "data", "geothai", "v4");
const outputFile = path.join(process.cwd(), "server", "geography", "thai-address-data.generated.ts");

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function postalCode(value) {
  const normalized = String(value).padStart(5, "0");
  if (!/^\d{5}$/.test(normalized)) throw new Error(`Invalid postal code: ${String(value)}`);
  return normalized;
}

function assertArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  return value;
}

function option(record, kind) {
  if (!isRecord(record) || !Number.isInteger(record.code) || typeof record.name_th !== "string") throw new Error(`Invalid ${kind}`);
  return { code: record.code, nameTh: record.name_th };
}

function postalAddress(record) {
  if (!isRecord(record)
    || !Number.isInteger(record.province_code) || typeof record.province_name_th !== "string"
    || !Number.isInteger(record.district_code) || typeof record.district_name_th !== "string"
    || !Number.isInteger(record.subdistrict_code) || typeof record.subdistrict_name_th !== "string") {
    throw new Error("Invalid postal lookup address");
  }
  return record;
}

function sortedPostalCodes(codes) {
  return [...codes].sort();
}

export function generateThaiAddressData({ geo, postalLookup }) {
  const provinces = [];
  const districtsByProvince = {};
  const subdistrictsByDistrict = {};
  const provinceByCode = new Map();
  const districtByCode = new Map();
  const subdistrictByCode = new Map();

  for (const provinceRecord of assertArray(geo, "geo")) {
    const province = option(provinceRecord, "province");
    if (provinceByCode.has(province.code)) throw new Error(`Duplicate province code: ${province.code}`);
    const provinceEntry = { ...province, districts: new Map() };
    provinceByCode.set(province.code, provinceEntry);
    provinces.push(province);
    const districts = [];
    districtsByProvince[province.code] = districts;

    for (const districtRecord of assertArray(provinceRecord.districts, "districts")) {
      const district = option(districtRecord, "district");
      if (districtByCode.has(district.code)) throw new Error(`Duplicate district code: ${district.code}`);
      const districtEntry = { ...district, provinceCode: province.code, subdistricts: new Map(), postalCodes: new Set() };
      districtByCode.set(district.code, districtEntry);
      provinceEntry.districts.set(district.code, districtEntry);
      districts.push({ ...district, provinceCode: province.code, postalCodes: [] });
      const subdistricts = [];
      subdistrictsByDistrict[district.code] = subdistricts;

      for (const subdistrictRecord of assertArray(districtRecord.subdistricts, "subdistricts")) {
        const subdistrict = option(subdistrictRecord, "subdistrict");
        if (subdistrictByCode.has(subdistrict.code)) throw new Error(`Duplicate subdistrict code: ${subdistrict.code}`);
        const code = postalCode(subdistrictRecord.postal_code);
        const subdistrictEntry = { ...subdistrict, provinceCode: province.code, districtCode: district.code, postalCodes: new Set([code]) };
        subdistrictByCode.set(subdistrict.code, subdistrictEntry);
        districtEntry.subdistricts.set(subdistrict.code, subdistrictEntry);
        districtEntry.postalCodes.add(code);
        subdistricts.push({ ...subdistrict, provinceCode: province.code, districtCode: district.code, postalCodes: [] });
      }
    }
  }

  if (!isRecord(postalLookup)) throw new Error("postal lookup must be an object");
  const candidatesByPostalCode = {};
  for (const [rawPostalCode, row] of Object.entries(postalLookup)) {
    if (!isRecord(row)) throw new Error(`Invalid postal lookup ${rawPostalCode}`);
    const code = postalCode(row.postal_code ?? rawPostalCode);
    const candidates = [];
    for (const rawAddress of assertArray(row.addresses, `postal lookup ${code}`)) {
      const address = postalAddress(rawAddress);
      const province = provinceByCode.get(address.province_code);
      const district = districtByCode.get(address.district_code);
      const subdistrict = subdistrictByCode.get(address.subdistrict_code);
      if (!province || !district || !subdistrict
        || province.nameTh !== address.province_name_th
        || district.provinceCode !== province.code || district.nameTh !== address.district_name_th
        || subdistrict.provinceCode !== province.code || subdistrict.districtCode !== district.code || subdistrict.nameTh !== address.subdistrict_name_th) {
        throw new Error(`Postal lookup ${code} does not match Geo hierarchy`);
      }
      district.postalCodes.add(code);
      subdistrict.postalCodes.add(code);
      candidates.push({
        province: { code: province.code, nameTh: province.nameTh },
        district: { code: district.code, nameTh: district.nameTh },
        subdistrict: { code: subdistrict.code, nameTh: subdistrict.nameTh },
        postalCode: code,
      });
    }
    candidatesByPostalCode[code] = candidates;
  }

  for (const districts of Object.values(districtsByProvince)) {
    for (const district of districts) district.postalCodes = sortedPostalCodes(districtByCode.get(district.code).postalCodes);
  }
  for (const subdistricts of Object.values(subdistrictsByDistrict)) {
    for (const subdistrict of subdistricts) subdistrict.postalCodes = sortedPostalCodes(subdistrictByCode.get(subdistrict.code).postalCodes);
  }

  return { provinces, districtsByProvince, subdistrictsByDistrict, candidatesByPostalCode };
}

async function readJson(file) {
  return JSON.parse(await readFile(path.join(sourceDirectory, file), "utf8"));
}

async function main() {
  const [geo, postalLookup] = await Promise.all([readJson("geo.json"), readJson("postal_lookup.json")]);
  const data = generateThaiAddressData({ geo, postalLookup });
  const output = `// Generated by scripts/generate-thai-address-data.mjs. Do not edit manually.\nimport "server-only";\nimport type { ThaiAddressDataIndex } from "./thai-address-types.ts";\n\nexport const thaiAddressData: ThaiAddressDataIndex = ${JSON.stringify(data)};\n`;
  await writeFile(outputFile, output, "utf8");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
