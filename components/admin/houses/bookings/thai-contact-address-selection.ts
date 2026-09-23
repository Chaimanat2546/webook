import type { ThaiAddressOption, ThaiAddressSubdistrictOption } from "@/server/geography/thai-address-types";

type ContactAddressPatch = Partial<{
  district: string | null;
  postal_code: string | null;
  province: string | null;
  sub_district: string | null;
}>;

interface SelectionRequest {
  onChange: (patch: ContactAddressPatch) => void;
  setDistrictCode: (code: number | null) => void;
  setProvinceCode: (code: number | null) => void;
  setSubdistrictCode: (code: number | null) => void;
}

export interface ThaiContactAddressSelectionController {
  chooseDistrict(option: ThaiAddressOption | null): void;
  chooseProvince(option: ThaiAddressOption | null): void;
  chooseSubdistrict(option: ThaiAddressSubdistrictOption | null): void;
}

export function createThaiContactAddressSelectionController(request: SelectionRequest): ThaiContactAddressSelectionController {
  return {
    chooseProvince(option) {
      request.setProvinceCode(option?.code ?? null);
      request.setDistrictCode(null);
      request.setSubdistrictCode(null);
      request.onChange({ province: option?.nameTh ?? null, district: null, sub_district: null });
    },
    chooseDistrict(option) {
      request.setDistrictCode(option?.code ?? null);
      request.setSubdistrictCode(null);
      request.onChange({ district: option?.nameTh ?? null, sub_district: null });
    },
    chooseSubdistrict(option) {
      request.setSubdistrictCode(option?.code ?? null);
      if (!option) {
        request.onChange({ sub_district: null });
        return;
      }
      request.onChange({ sub_district: option.nameTh, ...(option.postalCodes.length === 1 ? { postal_code: option.postalCodes[0] } : {}) });
    },
  };
}
