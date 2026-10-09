import 'server-only';
import { record } from '../../lib/house-bookings.ts';
import { validateSourceUrl } from '../calendar/fetch-ical.ts';
export interface CalendarSourceInput { sourceId:string|null; label:string;url:string|null;enabled:boolean }
export function parseCalendarSourceInput(input:unknown):CalendarSourceInput {
  const r=record(input),sourceId=r.sourceId==null?null:r.sourceId;
  if(sourceId!==null&&(typeof sourceId!=='string'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(sourceId)))throw new Error('รหัสแหล่งปฏิทินไม่ถูกต้อง');
  if(typeof r.label!=='string'||!r.label.trim()||r.label.trim().length>120)throw new Error('ชื่อแหล่งปฏิทินต้องมี 1–120 ตัวอักษร');
  if(r.enabled!==undefined&&typeof r.enabled!=='boolean')throw new Error('สถานะไม่ถูกต้อง');
  if(typeof r.url!=='string')throw new Error('URL ไม่ถูกต้อง');
  const raw=r.url.trim();
  if(!sourceId&&!raw)throw new Error('กรุณาระบุ URL ปฏิทิน Airbnb');
  return {sourceId,label:r.label.trim(),url:raw?validateSourceUrl(raw):null,enabled:r.enabled??true};
}
