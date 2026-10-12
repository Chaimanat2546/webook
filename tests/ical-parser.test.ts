import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseIcal } from '../server/calendar/parse-ical.ts';

const calendar = (...events: string[]) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events, 'END:VCALENDAR', ''].join('\r\n');
const event = (uid = 'sample', start = '20261015', end = '20261018', extra = '') =>
  ['BEGIN:VEVENT', `UID:${uid}`, `DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`, extra, 'END:VEVENT'].filter(Boolean).join('\r\n');

test('normalizes an all-day stay with exclusive checkout and drops private fields', () => {
  assert.deepEqual(parseIcal(calendar(event('synthetic', '20261015', '20261018', 'DESCRIPTION:private'))),
    [{ uid: 'synthetic', start: '2026-10-15', endExclusive: '2026-10-18', status: 'active' }]);
});
test('supports folded UID and default one-day end across leap day', () => {
  const text = calendar('BEGIN:VEVENT\r\nUID:folded-\r\n uid\r\nDTSTART;VALUE=DATE:20240229\r\nEND:VEVENT');
  assert.deepEqual(parseIcal(text), [{ uid: 'folded-uid', start: '2024-02-29', endExclusive: '2024-03-01', status: 'active' }]);
});
test('empty complete VCALENDAR is a valid snapshot', () => assert.deepEqual(parseIcal(calendar()), []));
test('explicit cancellation does not need stay dates', () => {
  assert.deepEqual(parseIcal(calendar('BEGIN:VEVENT\r\nUID:cancelled\r\nSTATUS:CANCELLED\r\nEND:VEVENT')),
    [{ uid: 'cancelled', status: 'cancelled' }]);
});
for (const [name, text] of [
  ['truncated calendar', calendar(event()).replace('END:VCALENDAR', '')],
  ['missing uid', calendar(event().replace('UID:sample\r\n', ''))],
  ['invalid date', calendar(event('bad', '20260230'))],
  ['inverted stay', calendar(event('bad', '20261018', '20261015'))],
  ['time event', calendar(event().replace('DTSTART;VALUE=DATE:20261015', 'DTSTART:20261015T120000Z'))],
  ['recurrence', calendar(event('bad', '20261015', '20261018', 'RRULE:FREQ=DAILY'))],
  ['duration', calendar(event('bad', '20261015', '20261018', 'DURATION:P3D'))],
  ['conflicting duplicate uid', calendar(event(), event('sample', '20261016'))],
  ['multiple calendars', calendar(event()) + calendar()],
  ['duplicate DTSTART', calendar(event('bad', '20261015', '20261018', 'DTSTART;VALUE=DATE:20261016'))],
  ['mismatched event terminator', calendar(event().replace('END:VEVENT','END:VTODO'))],
  ['nested event', calendar('BEGIN:VTODO\r\n'+event()+'\r\nEND:VTODO')],
  ['unsupported free-busy calendar', calendar('BEGIN:VFREEBUSY\r\nFREEBUSY:20261015T000000Z/20261018T000000Z\r\nEND:VFREEBUSY')],
  ['partial scheduling request', calendar('METHOD:REQUEST',event())],
] as const) test(`rejects ${name} without returning a partial snapshot`, () => assert.throws(() => parseIcal(text)));
test('collapses identical duplicate events within one source', () => assert.equal(parseIcal(calendar(event(), event())).length, 1));
test('rejects a snapshot above the event limit', () => assert.throws(() => parseIcal(calendar(...Array.from({ length: 5001 }, (_, i) => event(`id-${i}`))))));
