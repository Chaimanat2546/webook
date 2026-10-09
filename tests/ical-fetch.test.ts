import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateSourceUrl, fetchIcal } from '../server/calendar/fetch-ical.ts';

const url = 'https://www.airbnb.com/calendar/ical/123.ics?t=synthetic';
test('allows the confirmed Airbnb export endpoint', () => assert.equal(validateSourceUrl(url), url));
for (const bad of ['http://www.airbnb.com/calendar/ical/123.ics', 'https://www.airbnb.com.evil.test/calendar/ical/123.ics',
  'https://user@www.airbnb.com/calendar/ical/123.ics', 'https://127.0.0.1/calendar.ics',
  'https://www.airbnb.com:444/calendar/ical/123.ics', 'https://www.airbnb.com/other', `${url}#x`]) {
  test('rejects unapproved URL without echoing it', () => assert.throws(() => validateSourceUrl(bad), /^Error: invalid_calendar_url$/));
}
test('fetches using manual redirect rejection and no-store', async () => {
  assert.equal(await fetchIcal(url, async (_url, init) => {
    assert.equal(init?.redirect, 'manual'); assert.equal(init?.cache, 'no-store');
    return new Response('calendar');
  }), 'calendar');
});
for (const status of [301, 302, 303, 307, 308]) {
  test(`rejects HTTP ${status} without following the destination`, async () => {
    await assert.rejects(fetchIcal(url, async () => new Response(null, {
      status, headers: { location: 'https://unapproved.example/private' },
    })), /^Error: calendar_http_error$/);
  });
}
test('rejects an oversized chunked body and cancels reading', async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(1_048_577)); }, cancel() { cancelled = true; } });
  await assert.rejects(fetchIcal(url, async () => new Response(stream)), /ical_too_large/);
  assert.ok(cancelled);
});
test('network errors cannot expose tokenized URLs', async () => {
  await assert.rejects(fetchIcal(url, async () => { throw new Error(url); }), /^Error: calendar_fetch_failed$/);
});
test('rejects HTTP error responses', async () => {
  await assert.rejects(fetchIcal(url, async () => new Response('private', { status: 403 })), /calendar_http_error/);
});
