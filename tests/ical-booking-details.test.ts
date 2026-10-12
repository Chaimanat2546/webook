import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildBookingGallery } from '../lib/booking-gallery.ts';
import { loadIcalBookingView } from '../components/admin/houses/bookings/load-ical-booking-details.ts';
import type { Booking } from '../lib/house-bookings.ts';
import { SiAirbnb } from 'react-icons/si';

test('Airbnb details render the installed Airbnb brand icon, not a calendar placeholder',async()=>{
  const Summary=await component('../components/admin/houses/bookings/ical-booking-summary.tsx','IcalBookingSummary');
  const html=renderToStaticMarkup(createElement(Summary,{booking:{check_in:'2026-10-09',check_out:'2026-10-10',booking_type:'airbnb',status:'confirmed'}}));
  const logoPath=renderToStaticMarkup(createElement(SiAirbnb)).match(/d="([^"]+)"/)?.[1];
  assert.ok(logoPath);
  assert.ok(html.includes(logoPath),'Airbnb brand SVG must be shown in the provider row');
  const other=renderToStaticMarkup(createElement(Summary,{booking:{check_in:'2026-10-09',check_out:'2026-10-10',booking_type:'other',status:'confirmed'}}));
  assert.ok(!other.includes(logoPath),'other providers must not be represented as Airbnb');
});

async function component(file: string, name: string) {
  const output = await build({entryPoints:[fileURLToPath(new URL(file,import.meta.url))],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',loader:{'.css':'empty'}});
  const loaded={exports:{} as Record<string,unknown>};
  new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),loaded,loaded.exports);
  return loaded.exports[name] as ComponentType<Record<string,unknown>>;
}

test('read-only calendar highlights occupied nights but not exclusive checkout and cannot create bookings',async()=>{
  const Days=await component('../components/admin/bookings/booking-gallery-days.tsx','BookingGalleryDays');
  const card=buildBookingGallery([{id:'listing',property_id:'100',title:'บ้านทดสอบ',location_zone:null}],
    [{id:'external',listing_id:'listing',houseid:'100',check_in:'2026-10-09',check_out:'2026-10-10',status:'confirmed',calendar_source_id:'source',booking_type:'airbnb'}],'2026-10')[0];
  const html=renderToStaticMarkup(createElement(Days,{card,month:'2026-10',today:'2026-10-01',readOnly:true,selectedStart:'2026-10-09',selectedEnd:'2026-10-10',showCaptions:true}));
  assert.ok(!html.includes('สร้างการจอง'));
  assert.equal((html.match(/data-selected="true"/g)??[]).length,1);
  assert.match(html, /data-selected="true"[^>]*aria-label="[^"]*2026-10-09/);
  assert.doesNotMatch(html, /data-selected="true"[^>]*aria-label="[^"]*2026-10-10/);
  assert.equal((html.match(/disabled=""/g)??[]).length,42);
  assert.ok(html.includes('iCal (Airbnb)'));
});

test('details reload the booking after calendar sync instead of showing a stale active snapshot',async()=>{
  const calls:string[]=[];
  const card=buildBookingGallery([{id:'listing',property_id:'100',title:'บ้าน',location_zone:null}],[],'2026-10')[0];
  const fresh={id:'external',houseid:'100',calendar_source_id:'source',status:'cancelled',check_in:'2026-11-09',check_out:'2026-11-11'} as Booking;
  const view=await loadIcalBookingView('100','external',{
    async refreshCalendar(){calls.push('sync');return {ok:true,data:[card]};},
    async loadBooking(){calls.push('booking');return {ok:true,data:fresh};},
  });
  assert.deepEqual(calls,['sync','booking']);
  assert.equal(view.booking.status,'cancelled');
  assert.equal(view.booking.check_in,'2026-11-09');
  assert.equal(view.card,card);
});

test('read-only selected nights remain exclusive across a month boundary',async()=>{
  const Days=await component('../components/admin/bookings/booking-gallery-days.tsx','BookingGalleryDays');
  const card=buildBookingGallery([{id:'listing',property_id:'100',title:'บ้าน',location_zone:null}],[],'2026-10')[0];
  const html=renderToStaticMarkup(createElement(Days,{card,month:'2026-10',today:'2026-10-01',readOnly:true,selectedStart:'2026-10-30',selectedEnd:'2026-11-02'}));
  for(const day of ['2026-10-30','2026-10-31','2026-11-01'])assert.match(html,new RegExp(`data-selected="true"[^>]*aria-label="[^"]*${day}[^\"]*คืนที่เข้าพักของรายการนี้`));
  assert.doesNotMatch(html,/data-selected="true"[^>]*aria-label="[^"]*2026-11-02/);
});

test('failed sync cannot produce a freshly stamped booking view',async()=>{
  let loaded=false;
  await assert.rejects(loadIcalBookingView('100','external',{
    async refreshCalendar(){return {ok:false,message:'failed'};},
    async loadBooking(){loaded=true;throw new Error('must not run');},
  }),/failed/);
  assert.equal(loaded,false);
});

test('external summary shows Thai dates and nights without exposing customer or editing controls',async()=>{
  const Summary=await component('../components/admin/houses/bookings/ical-booking-summary.tsx','IcalBookingSummary');
  const booking={check_in:'2026-10-09',check_out:'2026-10-10',booking_type:'airbnb',status:'confirmed',customer:{first_name:'PRIVATE_GUEST'},note:'PRIVATE_NOTE',price_sell:987654};
  const source={label:'Airbnb บ้านทะเล',last_synced_at:'2026-10-09T10:21:00Z',last_error_code:null};
  const html=renderToStaticMarkup(createElement(Summary,{booking,source}));
  for(const text of ['Airbnb','9 ต.ค. 2569','10 ต.ค. 2569','1 คืน','ปิดรับจอง','17:21','อ่านอย่างเดียว','cache 5 นาที'])assert.ok(html.includes(text),text);
  for(const text of ['PRIVATE_GUEST','PRIVATE_NOTE','987654','<input','<select','บันทึก','1–2 ชั่วโมง'])assert.ok(!html.includes(text),text);
});

test('failed and cancelled sources do not falsely claim fresh or blocked availability',async()=>{
  const Summary=await component('../components/admin/houses/bookings/ical-booking-summary.tsx','IcalBookingSummary');
  const html=renderToStaticMarkup(createElement(Summary,{booking:{check_in:'2026-10-09',check_out:'2026-10-10',booking_type:'airbnb',status:'cancelled'},source:{label:'ทดสอบ',last_synced_at:null,last_error_code:'calendar_timeout'}}));
  assert.ok(html.includes('ยกเลิกจากต้นทาง'));
  assert.ok(html.includes('ยังไม่เคยซิงก์สำเร็จ'));
  assert.ok(html.includes('ข้อมูลนี้อาจไม่ล่าสุด'));
});
