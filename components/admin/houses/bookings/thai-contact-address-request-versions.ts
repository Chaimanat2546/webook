export interface ThaiAddressRequestVersions {
  invalidateUserAddressChange(): void;
  isDistrictsCurrent(version: number): boolean;
  isInitializationCurrent(version: number): boolean;
  isPostalCurrent(version: number): boolean;
  isSubdistrictsCurrent(version: number): boolean;
  nextDistricts(): number;
  nextInitialization(): number;
  nextPostal(): number;
  nextSubdistricts(): number;
}

export function createThaiAddressRequestVersions(): ThaiAddressRequestVersions {
  let postal = 0;
  let districts = 0;
  let initialization = 0;
  let subdistricts = 0;

  return {
    invalidateUserAddressChange() { postal += 1; initialization += 1; },
    isDistrictsCurrent(version) { return version === districts; },
    isInitializationCurrent(version) { return version === initialization; },
    isPostalCurrent(version) { return version === postal; },
    isSubdistrictsCurrent(version) { return version === subdistricts; },
    nextDistricts() { districts += 1; return districts; },
    nextInitialization() { initialization += 1; return initialization; },
    nextPostal() { postal += 1; return postal; },
    nextSubdistricts() { subdistricts += 1; return subdistricts; },
  };
}
