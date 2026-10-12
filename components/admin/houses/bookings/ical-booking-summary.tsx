import { CalendarDays, Info, LockKeyhole, UserRound } from 'lucide-react';
import { SiAirbnb } from 'react-icons/si';
import type { Booking } from '@/lib/house-bookings';
import { nightsBetween } from '@/lib/house-bookings';
import type { CalendarSourceSummary } from '@/lib/ical-calendar';
import { Badge } from '@/components/ui/badge';

interface Props { booking: Booking; source?: CalendarSourceSummary }
const providers: Record<string, string> = {airbnb:'Airbnb',agoda:'Agoda',booking_com:'Booking.com',other:'ปฏิทินภายนอก'};
export function icalProviderName(provider: string | null) { return providers[provider ?? 'other'] ?? 'ปฏิทินภายนอก'; }
export function icalDisplayDate(day: string) {
  return new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${day}T00:00:00Z`));
}

export function IcalBookingSummary({booking,source}:Props) {
  const provider=icalProviderName(booking.booking_type);
  const synced=source?.last_synced_at ? new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'}).format(new Date(source.last_synced_at)) : source ? 'ยังไม่เคยซิงก์สำเร็จ' : 'ยังไม่มีข้อมูลเวลาซิงก์';
  return <section className="min-w-0 space-y-3" aria-label="รายละเอียดปฏิทินภายนอก">
    <div className="overflow-hidden rounded-xl border border-blue-200 dark:border-blue-900">
      <div className="flex items-center gap-2 bg-blue-100 px-4 py-3 text-blue-800 dark:bg-blue-950 dark:text-blue-200"><CalendarDays aria-hidden className="size-5"/><h3 className="font-semibold">ข้อมูลจากปฏิทินภายนอก</h3><Badge className="ml-auto bg-blue-600 text-white">iCal</Badge></div>
      <div className="space-y-4 p-4">
        <div><p className="text-xl font-semibold leading-relaxed">{icalDisplayDate(booking.check_in)} – {icalDisplayDate(booking.check_out)}</p><p className="text-sm text-muted-foreground">วันไม่ว่างจาก {provider}</p></div>
        <div className="flex items-center gap-3 border-t pt-4">{booking.booking_type==='airbnb'?<SiAirbnb aria-hidden className="size-10 shrink-0 rounded-xl bg-[#FF5A5F] p-2 text-white"/>:<CalendarDays aria-hidden className="size-10 shrink-0 rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-blue-950"/>}<div className="min-w-0"><p className="break-words font-semibold">{provider}</p><p className="break-words text-sm text-muted-foreground">แหล่งข้อมูล: {source?.label ?? 'iCal'}</p></div></div>
      </div>
    </div>
    <dl className="grid grid-cols-2 gap-3">
      <Fact label="วันเช็กอิน" value={icalDisplayDate(booking.check_in)}/>
      <Fact label="วันเช็กเอาต์" value={icalDisplayDate(booking.check_out)}/>
      <Fact label="จำนวนคืน" value={`${nightsBetween(booking.check_in,booking.check_out)} คืน`}/>
      <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-950/40"><dt className="text-sm text-muted-foreground">สถานะ</dt><dd className="mt-1 flex items-center gap-2 font-semibold text-blue-700 dark:text-blue-300"><LockKeyhole aria-hidden className="size-4"/>{booking.status==='cancelled'?'ยกเลิกจากต้นทาง':'ปิดรับจอง'}</dd></div>
    </dl>
    <div className="rounded-xl bg-blue-50 p-4 text-sm leading-relaxed dark:bg-blue-950/40"><h3 className="mb-2 flex items-center gap-2 font-semibold text-blue-700 dark:text-blue-300"><Info aria-hidden className="size-4"/>หมายเหตุ</h3><ul className="list-disc space-y-1 pl-5">
      <li>อาจเป็นการจองหรือวันที่เจ้าของบล็อกปฏิทิน</li><li>ไม่มีข้อมูลลูกค้า ราคา หรือรายละเอียดการจอง</li><li>อ่านอย่างเดียว ไม่สามารถแก้ไขหรือยกเลิกจากระบบนี้</li><li>หากต้องการเปลี่ยนแปลง กรุณาดำเนินการที่ {provider}</li><li>วันเช็กเอาต์ไม่รวมอยู่ในคืนที่ปิดรับจอง</li>
    </ul></div>
    <div className="rounded-xl border p-4"><h3 className="flex items-center gap-2 text-sm font-semibold"><UserRound aria-hidden className="size-4"/>ข้อมูลลูกค้า</h3><p className="mt-1 text-sm text-muted-foreground">ไม่มีข้อมูลจาก iCal</p></div>
    <div className="rounded-xl border p-4 text-sm"><p className="font-semibold">ซิงก์สำเร็จล่าสุด</p><p className="mt-1 text-muted-foreground">{synced} · เวลาไทย</p>{source?.last_error_code && <p role="status" className="mt-2 text-amber-700 dark:text-amber-300">ซิงก์ล่าสุดไม่สำเร็จ ข้อมูลนี้อาจไม่ล่าสุด</p>}<p className="mt-2 text-xs text-muted-foreground">ตรวจเมื่อเปิดดูปฏิทิน โดยใช้ cache 5 นาที ไม่ใช่ข้อมูล real-time</p></div>
  </section>;
}
function Fact({label,value}:{label:string;value:string}) {return <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-950/40"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>;}
