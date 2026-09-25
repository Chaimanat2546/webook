import type { BookingHouseInformation } from "@/lib/house-bookings";

export function BookingHouseInformationDetails({ data }: { data: BookingHouseInformation }) {
  const money = (value: number | null) => value === null ? "ไม่ระบุ" : `${new Intl.NumberFormat("th-TH").format(value)} บาท`;
  const time = (value: string | null) => value ? `${value.slice(0, 5)} น.` : "ไม่ระบุ";
  const rows = [
    { label: "ราคาคนเสริม", value: money(data.extra_beds) },
    { label: "ประกันที่พัก", value: money(data.insurance_fee) },
    { label: "เวลาเช็คอิน", value: time(data.checkin_time) },
    { label: "เวลาเช็คเอาท์", value: time(data.checkout_time) },
  ];
  return <dl className="grid grid-cols-2 gap-3 text-sm">
    {rows.map(row => <div key={row.label} className="min-w-0 space-y-1">
      <dt className="text-xs text-muted-foreground">{row.label}</dt>
      <dd className="break-words font-medium tabular-nums">{row.value}</dd>
    </div>)}
  </dl>;
}
