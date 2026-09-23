import "server-only";

import { thaiAddressData } from "./thai-address-data.generated.ts";
import type {
  ThaiAddressCandidate,
  ThaiAddressDataIndex,
  ThaiAddressOption,
  ThaiAddressRepository,
  ThaiAddressSubdistrict,
  ThaiAddressSubdistrictOption,
} from "./thai-address-types.ts";

function ordered<T extends ThaiAddressOption & { postalCodes?: string[] }>(options: readonly T[], postalCode?: string): T[] {
  const unique = new Map<number, T>();
  for (const option of options) unique.set(option.code, option);

  return [...unique.values()]
    .sort((left, right) => {
      const postcodeDifference = Number(right.postalCodes?.includes(postalCode ?? "")) - Number(left.postalCodes?.includes(postalCode ?? ""));
      return postcodeDifference || left.nameTh.localeCompare(right.nameTh, "th");
    });
}

function orderedOptions<T extends ThaiAddressOption & { postalCodes?: string[] }>(options: readonly T[], postalCode?: string): ThaiAddressOption[] {
  return ordered(options, postalCode).map(({ code, nameTh }) => ({ code, nameTh }));
}

function orderedSubdistrictOptions(options: readonly ThaiAddressSubdistrict[], postalCode?: string): ThaiAddressSubdistrictOption[] {
  return ordered(options, postalCode).map(({ code, nameTh, postalCodes }) => ({ code, nameTh, postalCodes }));
}

function postalMatches(index: ThaiAddressDataIndex, postalCode: string): ThaiAddressCandidate[] {
  return [...(index.candidatesByPostalCode[postalCode] ?? [])]
    .sort((left, right) => left.province.nameTh.localeCompare(right.province.nameTh, "th") || left.district.nameTh.localeCompare(right.district.nameTh, "th") || left.subdistrict.nameTh.localeCompare(right.subdistrict.nameTh, "th"));
}

export function createThaiAddressRepository(index: ThaiAddressDataIndex): ThaiAddressRepository {
  return {
    postalCandidates(postalCode) {
      return postalMatches(index, postalCode);
    },
    provinces(postalCode) {
      const matchingCodes = new Set(postalCode ? postalMatches(index, postalCode).map((candidate) => candidate.province.code) : []);
      return orderedOptions(index.provinces.map((province) => ({ ...province, postalCodes: matchingCodes.has(province.code) ? [postalCode ?? ""] : [] })), postalCode);
    },
    districts(provinceCode, postalCode) {
      return orderedOptions(index.districtsByProvince[provinceCode] ?? [], postalCode);
    },
    subdistricts(districtCode, postalCode) {
      return orderedSubdistrictOptions(index.subdistrictsByDistrict[districtCode] ?? [], postalCode);
    },
    resolveNames(value) {
      const province = index.provinces.find((option) => option.nameTh === value.province);
      if (!province) return { provinceCode: null, districtCode: null, subdistrictCode: null };

      const district = (index.districtsByProvince[province.code] ?? []).find((option) => option.nameTh === value.district);
      if (!district) return { provinceCode: province.code, districtCode: null, subdistrictCode: null };

      const subdistrict = (index.subdistrictsByDistrict[district.code] ?? []).find((option) => option.nameTh === value.subdistrict);
      return { provinceCode: province.code, districtCode: district.code, subdistrictCode: subdistrict?.code ?? null };
    },
  };
}

export const thaiAddressRepository = createThaiAddressRepository(thaiAddressData);
