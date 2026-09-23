import type { ThaiAddressCandidate, ThaiAddressOption } from "@/server/geography/thai-address-types";
import type { ThaiContactAddressInitializationController } from "./thai-contact-address-initialization";
import type { ThaiAddressRequestVersions } from "./thai-contact-address-request-versions";

type LookupResult<T> = { ok: true; data: T } | { ok: false };

interface PostalLookupRequest {
  chooseDistrict: (option: ThaiAddressOption) => void;
  chooseProvince: (option: ThaiAddressOption) => void;
  listDistricts: (provinceCode: number, postalCode: string) => Promise<LookupResult<ThaiAddressOption[]>>;
  lookupPostalCode: (postalCode: string) => Promise<LookupResult<{ candidates: ThaiAddressCandidate[] }>>;
  onPostalCode: (postalCode: string | null) => void;
  setCandidates: (candidates: ThaiAddressCandidate[]) => void;
  setMessage: (message: string) => void;
}

export interface ThaiContactAddressPostalLookupController {
  updatePostalCode(value: string, request: PostalLookupRequest): Promise<void>;
}

export function createThaiContactAddressPostalLookupController(versions: ThaiAddressRequestVersions, initialization: ThaiContactAddressInitializationController): ThaiContactAddressPostalLookupController {
  return {
    async updatePostalCode(value, request) {
      const postalCode = value.replace(/\D/g, "").slice(0, 5);
      request.onPostalCode(postalCode || null);
      request.setCandidates([]);
      request.setMessage("");
      initialization.userChanged();
      if (postalCode.length !== 5) return;
      const version = versions.nextPostal();
      const result = await request.lookupPostalCode(postalCode);
      if (!versions.isPostalCurrent(version) || !result.ok) return;
      request.setCandidates(result.data.candidates);
      if (result.data.candidates.length === 0) {
        request.setMessage("ไม่พบพื้นที่สำหรับรหัสไปรษณีย์นี้ กรุณาเลือกจังหวัด อำเภอ และตำบลด้วยตนเอง");
        return;
      }
      const provinces = [...new Map(result.data.candidates.map((candidate) => [candidate.province.code, candidate.province])).values()];
      if (provinces.length !== 1) return;
      const districts = [...new Map(result.data.candidates.map((candidate) => [candidate.district.code, candidate.district])).values()];
      const districtResult = await request.listDistricts(provinces[0].code, postalCode);
      if (!versions.isPostalCurrent(version)) return;
      request.chooseProvince(provinces[0]);
      if (districtResult.ok && districts.length === 1) request.chooseDistrict(districts[0]);
    },
  };
}
