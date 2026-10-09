import { bookingConflict, occupiedNight, type OccupiedBooking } from '@/lib/booking-availability';

interface Props {
  day: string; dayNumber: string; today: string; rows: OccupiedBooking[];
  start: string; end: string; excludeId?: string; ready: boolean;
  readOnly?: boolean; selected?: boolean;
  onChange: (start: string, end: string) => void;
}

function displayDate(day: string) {
  return new Intl.DateTimeFormat('th-TH', {day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(`${day}T00:00:00Z`));
}

export function BookingDateCell({day,dayNumber,today,rows,start,end,excludeId,ready,onChange,readOnly=false,selected:showSelected=true}: Props) {
  const pickingEnd=!!start&&!end;
  const occupied=occupiedNight(rows,day,excludeId);
  const canEnd=pickingEnd&&day>start&&!bookingConflict(rows,start,day,excludeId);
  const blocked=day<today||!ready||(!!occupied&&!canEnd);
  const selected=showSelected&&(readOnly?!!start&&day>=start&&day<end:day===start||day===end||(!!end&&day>start&&day<end));
  const label=occupied?occupied.calendar_source_id?'iCal':occupied.status==='repair'?'ปิดซ่อม':occupied.status==='waiting'?'รอโอน':'ติดจอง':'ว่าง';
  const caption=readOnly?(selected?'คืนที่เข้าพัก':occupied?label:''):day===start?'เข้า':day===end?'ออก':occupied&&canEnd?'ออกได้':occupied?label:'';
  const reason=readOnly?'อ่านอย่างเดียว':day<today?'วันที่ผ่านมาแล้ว':!ready?'กำลังโหลดวันว่าง':blocked?`${displayDate(day)} ${label} เลือกเข้าพักไม่ได้`:pickingEnd&&!canEnd?'เลือกวันเช็กอิน':canEnd?'เลือกวันเช็กเอาต์':'เลือกวันเช็กอิน';
  return <button type="button" disabled={readOnly||blocked} title={reason} aria-label={`${day} ${readOnly&&selected?'คืนที่เข้าพักของรายการนี้':label} ${reason}`} aria-pressed={selected}
    data-past={!readOnly&&day<today||undefined}
    data-range={selected?(day===start?'start':!readOnly&&day===end?'end':'middle'):undefined}
    data-status={occupied?occupied.calendar_source_id?'external':occupied.status==='repair'?'repair':occupied.status==='waiting'?'waiting':'confirmed':'free'}
    className="booking-range-day" onClick={()=>{if(readOnly||blocked)return;if(canEnd)onChange(start,day);else onChange(day,'');}}>
    <span className="text-base font-semibold">{dayNumber}</span><span className="min-h-3 text-[10px] leading-3">{caption}</span>
  </button>;
}
