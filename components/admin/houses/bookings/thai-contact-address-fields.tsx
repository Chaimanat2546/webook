"use client";

import { useEffect, useId, useRef, useState } from "react";
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
import type { ThaiAddressOption, ThaiAddressSubdistrictOption } from "@/server/geography/thai-address-types";
import { createThaiContactAddressInitializationController } from "./thai-contact-address-initialization";
import { createThaiContactAddressPostalLookupController } from "./thai-contact-address-postal-lookup";
import { createThaiAddressRequestVersions } from "./thai-contact-address-request-versions";
import { createThaiContactAddressSelectionController } from "./thai-contact-address-selection";

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
  const id = useId();
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  return <div ref={setPortalContainer} className="min-w-0 space-y-1">
    <label htmlFor={id}>{label}</label>
    <Combobox
      itemToStringLabel={(option: ThaiAddressOption) => option.nameTh}
      itemToStringValue={(option: ThaiAddressOption) => option.nameTh}
      items={options}
      onValueChange={(option) => onChange(option && option.code > 0 ? option : null)}
      value={value}
    >
      <ComboboxInput id={id} className="w-full" disabled={disabled} placeholder={placeholder} />
      <ComboboxContent container={portalContainer}>
        <ComboboxEmpty>ไม่พบข้อมูล</ComboboxEmpty>
        <ComboboxList>
          {(option: ThaiAddressOption) => <ComboboxItem key={option.code} value={option}>{option.nameTh}</ComboboxItem>}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  </div>;
}

export function ThaiContactAddressFields({ disabled, onChange, propertyId, value }: Props) {
  const [provinceOptions, setProvinceOptions] = useState<ThaiAddressOption[]>([]);
  const [districtOptions, setDistrictOptions] = useState<ThaiAddressOption[]>([]);
  const [subdistrictOptions, setSubdistrictOptions] = useState<ThaiAddressSubdistrictOption[]>([]);
  const [provinceCode, setProvinceCode] = useState<number | null>(null);
  const [districtCode, setDistrictCode] = useState<number | null>(null);
  const [subdistrictCode, setSubdistrictCode] = useState<number | null>(null);
  const [postalMessage, setPostalMessage] = useState("");
  const initialValue = useRef(value);
  const [requestChannels] = useState(() => {
    const versions = createThaiAddressRequestVersions();
    const initialization = createThaiContactAddressInitializationController(versions);
    return { initialization, postalLookup: createThaiContactAddressPostalLookupController(versions, initialization), versions };
  });
  const selection = createThaiContactAddressSelectionController({
    onChange,
    setDistrictCode,
    setProvinceCode,
    setSubdistrictCode,
  });

  useEffect(() => {
    let active = true;
    void requestChannels.initialization.start({
      applyProvinces: setProvinceOptions,
      applyResolved: (selection) => {
        setProvinceCode(selection.provinceCode);
        setDistrictCode(selection.districtCode);
        setSubdistrictCode(selection.subdistrictCode);
      },
      isActive: () => active,
      listProvinces: () => listThaiProvincesAction(propertyId, ""),
      resolveNames: () => resolveThaiAddressNamesAction(propertyId, { province: initialValue.current.province, district: initialValue.current.district, subdistrict: initialValue.current.sub_district }),
    });
    return () => { active = false; };
  }, [propertyId, requestChannels.initialization]);

  useEffect(() => {
    if (provinceCode === null) return;
    const version = requestChannels.versions.nextDistricts();
    void (async () => {
      const result = await listThaiDistrictsAction(propertyId, provinceCode, value.postal_code ?? "");
      if (requestChannels.versions.isDistrictsCurrent(version) && result.ok) setDistrictOptions(result.data);
    })();
  }, [propertyId, provinceCode, requestChannels.versions, value.postal_code]);

  useEffect(() => {
    if (districtCode === null) return;
    const version = requestChannels.versions.nextSubdistricts();
    void (async () => {
      const result = await listThaiSubdistrictsAction(propertyId, districtCode, value.postal_code ?? "");
      if (requestChannels.versions.isSubdistrictsCurrent(version) && result.ok) setSubdistrictOptions(result.data);
    })();
  }, [districtCode, propertyId, requestChannels.versions, value.postal_code]);

  function chooseProvince(option: ThaiAddressOption | null) {
    requestChannels.initialization.userChanged();
    setDistrictOptions([]);
    setSubdistrictOptions([]);
    selection.chooseProvince(option);
  }

  function chooseDistrict(option: ThaiAddressOption | null) {
    requestChannels.initialization.userChanged();
    setSubdistrictOptions([]);
    selection.chooseDistrict(option);
  }

  function chooseSubdistrict(option: ThaiAddressOption | null) {
    requestChannels.initialization.userChanged();
    selection.chooseSubdistrict((option && subdistrictOptions.find((subdistrict) => subdistrict.code === option.code)) ?? null);
  }

  function updatePostalCode(next: string) {
    void requestChannels.postalLookup.updatePostalCode(next, {
      chooseDistrict,
      chooseProvince,
      listDistricts: (provinceCode, postalCode) => listThaiDistrictsAction(propertyId, provinceCode, postalCode),
      lookupPostalCode: (postalCode) => lookupThaiPostalCodeAction(propertyId, postalCode),
      onPostalCode: (postalCode) => onChange({ postal_code: postalCode }),
      setCandidates: () => undefined,
      setMessage: setPostalMessage,
    });
  }

  const selectedProvince = selectedOrLegacy(provinceOptions, provinceCode, value.province);
  const selectedDistrict = selectedOrLegacy(districtOptions, districtCode, value.district);
  const selectedSubdistrict = selectedOrLegacy(subdistrictOptions, subdistrictCode, value.sub_district);

  return <div className="contents">
    <label aria-label="ที่อยู่" className="space-y-1 sm:col-span-2">รายละเอียดที่อยู่<Textarea placeholder="บ้านเลขที่ หมู่ ซอย ถนน" rows={3} maxLength={10000} disabled={disabled} value={value.address ?? ""} onChange={(event) => onChange({ address: event.target.value || null })} /></label>
    <label aria-label="ประเทศ" className="space-y-1">ประเทศ<Input maxLength={100} disabled={disabled} value={value.country ?? ""} onChange={(event) => onChange({ country: event.target.value || null })} /></label>
    <label aria-label="รหัสไปรษณีย์" className="space-y-1">รหัสไปรษณีย์<Input type="tel" inputMode="numeric" maxLength={5} disabled={disabled} value={value.postal_code ?? ""} onChange={(event) => updatePostalCode(event.target.value)} />{postalMessage && <p className="text-sm text-muted-foreground">{postalMessage}</p>}</label>
    <AddressCombobox label="จังหวัด" disabled={disabled} options={provinceOptions} placeholder="ค้นหาจังหวัด" value={selectedProvince} onChange={chooseProvince} />
    <AddressCombobox label="อำเภอ / เขต" disabled={disabled || provinceCode === null} options={districtOptions} placeholder="ค้นหาอำเภอ" value={selectedDistrict} onChange={chooseDistrict} />
    <AddressCombobox label="ตำบล / แขวง" disabled={disabled || districtCode === null} options={subdistrictOptions} placeholder="เลือกหรือค้นหาตำบล" value={selectedSubdistrict} onChange={chooseSubdistrict} />
  </div>;
}
