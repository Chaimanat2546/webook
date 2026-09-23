export interface ThaiAddressRequestVersions {
  invalidatePostal(): void;
  isDistrictsCurrent(version: number): boolean;
  isPostalCurrent(version: number): boolean;
  isSubdistrictsCurrent(version: number): boolean;
  nextDistricts(): number;
  nextPostal(): number;
  nextSubdistricts(): number;
}

export function createThaiAddressRequestVersions(): ThaiAddressRequestVersions {
  let postal = 0;
  let districts = 0;
  let subdistricts = 0;

  return {
    invalidatePostal() { postal += 1; },
    isDistrictsCurrent(version) { return version === districts; },
    isPostalCurrent(version) { return version === postal; },
    isSubdistrictsCurrent(version) { return version === subdistricts; },
    nextDistricts() { districts += 1; return districts; },
    nextPostal() { postal += 1; return postal; },
    nextSubdistricts() { subdistricts += 1; return subdistricts; },
  };
}
