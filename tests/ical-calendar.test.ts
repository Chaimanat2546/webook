import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildBookingGallery } from '../lib/booking-gallery.ts';
import type { GalleryBookingSlice } from '../lib/booking-gallery.ts';

const house={id:'listing',property_id:'100',title:'Fixture',location_zone:null};
const booking=(id:string,source:string|null):GalleryBookingSlice=>({id,listing_id:'listing',houseid:'100',check_in:'2026-10-15',check_out:'2026-10-18',status:'confirmed',calendar_source_id:source,booking_type:source?'airbnb':'booking'});
test('external overlaps never overwrite the editable internal booking',()=>{
  for(const rows of [[booking('1',null),booking('2','source')],[booking('2','source'),booking('1',null)]]){
    const card=buildBookingGallery([house],rows,'2026-10')[0];
    assert.equal(card.days['2026-10-15'].bookingId,'1');
    assert.deepEqual(card.days['2026-10-15'].externalBookings,[{id:'2',provider:'airbnb'}]);
    assert.equal(card.bookedNights,3);
  }
});
test('multiple external sources stay visible with exclusive checkout',()=>{
  const card=buildBookingGallery([house],[booking('2','a'),booking('3','b')],'2026-10')[0];
  assert.equal(card.days['2026-10-15'].externalBookings?.length,2);
  assert.equal(card.days['2026-10-15'].tone,'external');
  assert.equal(card.days['2026-10-18'].tone,'free');
});
