"use client";

import { useEffect, useRef, useState } from "react";
import {
  listThaiDistrictsAction,
  listThaiProvincesAction,
  listThaiSubdistrictsAction,
  lookupThaiPostalCodeAction,
  resolveThaiAddressNamesAction,
} from "@/app/admin/houses/[propertyId]/bookings/actions";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ThaiAddressCandidate, ThaiAddressOption } from "@/server/geography/thai-address-types";
import { createThaiAddressRequestVersions } from "./thai-contact-address-request-versions";

export interface BookingContactAddressValue {
  address: string | null;
  country: string | null;
  postal_code: string | null;
  province: string | null;
  district: string | null;
  sub_district: string | null;
}

interface Props {
  disabled: boolean;
  onChange: (patch: Partial<BookingContactAddressValue>) => void;
  propertyId: string;
  value: BookingContactAddressValue;
}

function matchingOption(options: ThaiAddressOption[], code: number | null): ThaiAddressOption | null {
  return code === null ? null : options.find((option) => option.code === code) ?? null;
}

function selectedOrLegacy(options: ThaiAddressOption[], code: number | null, legacyName: string | null): ThaiAddressOption | null {
  return matchingOption(options, code) ?? (legacyName ? { code: -1, nameTh: legacyName } : null);
}

function AddressCombobox({ disabled, label, onChange, options, placeholder, value }: {
  disabled: boolean;
  label: string;
  onChange: (option: ThaiAddressOption | null) => void;
  options: ThaiAddressOption[];
  placeholder: string;
  value: ThaiAddressOption | null;
}) {
  return <label className="min-w-0 space-y-1">{label}
    <Combobox
      itemToStringValue={(option: ThaiAddressOption) => option.nameTh}
      items={options}
      onValueChange={(option) => onChange(option && option.code > 0 ? option : null)}
      value={value}
    >
      <ComboboxInput className="w-full" disabled={disabled} placeholder={placeholder} />
      <ComboboxContent>
        <ComboboxEmpty>ไม่พบข้อมูล</ComboboxEmpty>
        <ComboboxList>
          {(option: ThaiAddressOption) => <ComboboxItem key={option.code} value={option}>{option.nameTh}</ComboboxItem>}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  </label>;
}

export function ThaiContactAddressFields({ disabled, onChange, propertyId, value }: Props) {
  const [provinceOptions, setProvinceOptions] = useState<ThaiAddressOption[]>([]);
  const [districtOptions, setDistrictOptions] = useState<ThaiAddressOption[]>([]);
  const [subdistrictOptions, setSubdistrictOptions] = useState<ThaiAddressOption[]>([]);
  const [provinceCode, setProvinceCode] = useState<number | null>(null);
  const [districtCode, setDistrictCode] = useState<number | null>(null);
  const [subdistrictCode, setSubdistrictCode] = useState<number | null>(null);
  const [postalCandidates, setPostalCandidates] = useState<ThaiAddressCandidate[]>([]);
  const [postalMessage, setPostalMessage] = useState("");
  const initialValue = useRef(value);
  const requestVersions = useRef(createThaiAddressRequestVersions());

  useEffect(() => {
    let active = true;
    void (async () => {
      const [provinces, resolved] = await Promise.all([
        listThaiProvincesAction(propertyId, ""),
        resolveThaiAddressNamesAction(propertyId, { province: initialValue.current.province, district: initialValue.current.district, subdistrict: initialValue.current.sub_district }),
      ]);
      if (!active) return;
      if (provinces.ok) setProvinceOptions(provinces.data);
      if (resolved.ok) {
        setProvinceCode(resolved.data.provinceCode);
        setDistrictCode(resolved.data.districtCode);
        setSubdistrictCode(resolved.data.subdistrictCode);
      }
    })();
    return () => { active = false; };
  }, [propertyId]);

  useEffect(() => {
    if (provinceCode === null) return;
    const version = requestVersions.current.nextDistricts();
    void (async () => {
      const result = await listThaiDistrictsAction(propertyId, provinceCode, value.postal_code ?? "");
      if (requestVersions.current.isDistrictsCurrent(version) && result.ok) setDistrictOptions(result.data);
    })();
  }, [propertyId, provinceCode, value.postal_code]);

  useEffect(() => {
    if (districtCode === null) return;
    const version = requestVersions.current.nextSubdistricts();
    void (async () => {
      const result = await listThaiSubdistrictsAction(propertyId, districtCode, value.postal_code ?? "");
      if (requestVersions.current.isSubdistrictsCurrent(version) && result.ok) setSubdistrictOptions(result.data);
    })();
  }, [districtCode, propertyId, value.postal_code]);

  function chooseProvince(option: ThaiAddressOption | null) {
    requestVersions.current.invalidatePostal();
    setProvinceCode(option?.code ?? null);
    setDistrictCode(null);
    setSubdistrictCode(null);
    setDistrictOptions([]);
    setSubdistrictOptions([]);
    onChange({ province: option?.nameTh ?? null, district: null, sub_district: null });
  }

  function chooseDistrict(option: ThaiAddressOption | null) {
    requestVersions.current.invalidatePostal();
    setDistrictCode(option?.code ?? null);
    setSubdistrictCode(null);
    setSubdistrictOptions([]);
    onChange({ district: option?.nameTh ?? null, sub_district: null });
  }

  function chooseSubdistrict(option: ThaiAddressOption | null) {
    requestVersions.current.invalidatePostal();
    setSubdistrictCode(option?.code ?? null);
    if (!option) { onChange({ sub_district: null }); return; }
    const postalCodes = [...new Set(postalCandidates.filter((candidate) => candidate.subdistrict.code === option.code).map((candidate) => candidate.postalCode))];
    onChange({ sub_district: option.nameTh, ...(postalCodes.length === 1 ? { postal_code: postalCodes[0] } : {}) });
  }

  function updatePostalCode(next: string) {
    const postalCode = next.replace(/\D/g, "").slice(0, 5);
    onChange({ postal_code: postalCode || null });
    setPostalCandidates([]);
    setPostalMessage("");
    requestVersions.current.invalidatePostal();
    if (postalCode.length !== 5) return;
    const version = requestVersions.current.nextPostal();
    void (async () => {
      const result = await lookupThaiPostalCodeAction(propertyId, postalCode);
      if (!requestVersions.current.isPostalCurrent(version) || !result.ok) return;
      setPostalCandidates(result.data.candidates);
      if (result.data.candidates.length === 0) {
        setPostalMessage("ไม่พบพื้นที่สำหรับรหัสไปรษณีย์นี้ กรุณาเลือกจังหวัด อำเภอ และตำบลด้วยตนเอง");
        return;
      }
      const provinces = [...new Map(result.data.candidates.map((candidate) => [candidate.province.code, candidate.province])).values()];
      if (provinces.length === 1) {
        const districtResult = await listThaiDistrictsAction(propertyId, provinces[0].code, postalCode);
        if (!requestVersions.current.isPostalCurrent(version)) return;
        chooseProvince(provinces[0]);
        if (districtResult.ok && districtResult.data.length === 1) chooseDistrict(districtResult.data[0]);
      }
    })();
  }

  const selectedProvince = selectedOrLegacy(provinceOptions, provinceCode, value.province);
  const selectedDistrict = selectedOrLegacy(districtOptions, districtCode, value.district);
  const selectedSubdistrict = selectedOrLegacy(subdistrictOptions, subdistrictCode, value.sub_district);

  return <div className="contents">
    <label aria-label="ที่อยู่" className="space-y-1 sm:col-span-2">ที่อยู่<Textarea rows={3} maxLength={10000} disabled={disabled} value={value.address ?? ""} onChange={(event) => onChange({ address: event.target.value || null })} /></label>
    <label aria-label="ประเทศ" className="space-y-1">ประเทศ<Input maxLength={100} disabled={disabled} value={value.country ?? ""} onChange={(event) => onChange({ country: event.target.value || null })} /></label>
    <label aria-label="รหัสไปรษณีย์" className="space-y-1">รหัสไปรษณีย์<Input type="tel" inputMode="numeric" maxLength={5} disabled={disabled} value={value.postal_code ?? ""} onChange={(event) => updatePostalCode(event.target.value)} />{postalMessage && <p className="text-sm text-muted-foreground">{postalMessage}</p>}</label>
    <AddressCombobox label="จังหวัด" disabled={disabled} options={provinceOptions} placeholder="ค้นหาจังหวัด" value={selectedProvince} onChange={chooseProvince} />
    <AddressCombobox label="อำเภอ / เขต" disabled={disabled || provinceCode === null} options={districtOptions} placeholder="ค้นหาอำเภอ" value={selectedDistrict} onChange={chooseDistrict} />
    <AddressCombobox label="ตำบล / แขวง" disabled={disabled || districtCode === null} options={subdistrictOptions} placeholder="ค้นหาตำบล" value={selectedSubdistrict} onChange={chooseSubdistrict} />
  </div>;
}
