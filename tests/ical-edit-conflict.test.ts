import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bookingConflict } from '../lib/booking-availability.ts';
const external={id:'2',check_in:'2026-10-15',check_out:'2026-10-18',status:'confirmed',calendar_source_id:'source'};
test('unchanged internal stay can edit details despite external overlap',()=>{
  assert.equal(bookingConflict([external],'2026-10-15','2026-10-18','1',true),undefined);
});
test('new or changed stay still detects external conflicts',()=>{
  assert.equal(bookingConflict([external],'2026-10-15','2026-10-18'),external);
});
test('unchanged stay does not hide an internal conflict',()=>{
  const internal={...external,calendar_source_id:null};
  assert.equal(bookingConflict([external,internal],'2026-10-15','2026-10-18','1',true),internal);
});
