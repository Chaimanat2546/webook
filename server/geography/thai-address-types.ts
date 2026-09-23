export interface ThaiAddressOption {
  code: number;
  nameTh: string;
}

export interface ThaiAddressCandidate {
  province: ThaiAddressOption;
  district: ThaiAddressOption;
  subdistrict: ThaiAddressOption;
  postalCode: string;
}

export interface ThaiAddressDistrict extends ThaiAddressOption {
  provinceCode: number;
  postalCodes: string[];
}

export interface ThaiAddressSubdistrict extends ThaiAddressOption {
  provinceCode: number;
  districtCode: number;
  postalCodes: string[];
}

export interface ThaiAddressSubdistrictOption extends ThaiAddressOption {
  postalCodes: string[];
}

export interface ThaiAddressDataIndex {
  provinces: ThaiAddressOption[];
  districtsByProvince: Record<number, ThaiAddressDistrict[]>;
  subdistrictsByDistrict: Record<number, ThaiAddressSubdistrict[]>;
  candidatesByPostalCode: Record<string, ThaiAddressCandidate[]>;
}

export interface ThaiAddressSelection {
  provinceCode: number | null;
  districtCode: number | null;
  subdistrictCode: number | null;
}

export interface ThaiAddressRepository {
  postalCandidates(postalCode: string): ThaiAddressCandidate[];
  provinces(postalCode?: string): ThaiAddressOption[];
  districts(provinceCode: number, postalCode?: string): ThaiAddressOption[];
  subdistricts(districtCode: number, postalCode?: string): ThaiAddressSubdistrictOption[];
  resolveNames(value: { province: string | null; district: string | null; subdistrict: string | null }): ThaiAddressSelection;
}
