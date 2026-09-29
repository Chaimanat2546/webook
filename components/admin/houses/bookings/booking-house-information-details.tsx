import { useState } from "react";
import { bookingHouseInformationValue } from "@/lib/booking-house-information";
import type { BookingHouseInformation } from "@/lib/house-bookings";
import { Input } from "@/components/ui/input";

interface Props {
  data: BookingHouseInformation;
  values: BookingHouseInformation;
  onChange: (values: BookingHouseInformation) => void;
}

export function BookingHouseInformationDetails({ data, values, onChange }: Props) {
  const [touched, setTouched] = useState<Partial<Record<keyof BookingHouseInformation, boolean>>>({});
  const update = <K extends keyof BookingHouseInformation>(key: K, value: BookingHouseInformation[K]) => {
    setTouched(previous => ({ ...previous, [key]: true }));
    onChange({ ...values, [key]: value });
  };
  const moneyFields = [
    { key: "extra_person" as const, label: "ราคาคนเสริม" },
    { key: "insurance" as const, label: "ประกันที่พัก" },
  ];
  const timeFields = [
    { key: "checkin_time" as const, label: "เวลาเช็คอิน" },
    { key: "checkout_time" as const, label: "เวลาเช็คเอาท์" },
  ];
  return <><p className="text-xs text-muted-foreground">แก้ไขข้อมูลเฉพาะรายการจอง ไม่กระทบข้อมูลบ้านหลัก</p><div className="grid grid-cols-2 gap-3 text-sm">
    {moneyFields.map(({ key, label }) => <label key={key} className="min-w-0 space-y-1">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <Input type="number" min={0} max={999999999.99} step="0.01" value={bookingHouseInformationValue(values, data, key, touched[key] === true) ?? ""} onChange={event => update(key, event.target.value === "" ? null : event.target.valueAsNumber)} />
    </label>)}
    {timeFields.map(({ key, label }) => <label key={key} className="min-w-0 space-y-1">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <Input type="time" value={(bookingHouseInformationValue(values, data, key, touched[key] === true) ?? "").slice(0, 5)} onChange={event => update(key, event.target.value || null)} />
    </label>)}
  </div></>;
}
