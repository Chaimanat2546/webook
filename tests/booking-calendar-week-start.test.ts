import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';

test('house calendar and booking date picker explicitly configure Sunday before Thai locale defaults', async () => {
  for (const [file, exportedName, props] of [
    ['booking-calendar.tsx', 'HouseBookingCalendar', { propertyId: '2122' }],
    ['booking-date-range.tsx', 'BookingDateRange', { propertyId: '2122', start: '2026-08-01', end: '2026-08-03', revision: 0, onChange: () => {}, onValid: () => {} }],
  ] as const) {
    const firstDays: unknown[] = [];
    const output = await build({
      entryPoints: [fileURLToPath(new URL(`../components/admin/houses/bookings/${file}`, import.meta.url))],
      bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external',
      plugins: [{ name: 'calendar-boundary', setup(builder) {
        builder.onResolve({ filter: /\.css$/ }, () => ({ path: 'empty-css', namespace: 'empty-css' }));
        builder.onLoad({ filter: /.*/, namespace: 'empty-css' }, () => ({ contents: '', loader: 'js' }));
        builder.onResolve({ filter: /^@fullcalendar\/react$/ }, () => ({ path: 'test-fullcalendar', external: true }));
        builder.onResolve({ filter: /^@fullcalendar\/react\// }, () => ({ path: 'test-plugin', external: true }));
        builder.onResolve({ filter: /\/bookings\/actions$/ }, () => ({ path: 'test-actions', external: true }));
        builder.onResolve({ filter: /^\.\/booking-editor$/ }, () => ({ path: 'test-editor', external: true }));
      } }],
    });
    const loaded = { exports: {} as Record<string, unknown> };
    const require = createRequire(import.meta.url);
    new Function('require', 'module', 'exports', output.outputFiles[0].text)((id: string) => {
      // Capture our options at the third-party boundary; upstream grid rendering is not under test.
      if (id === 'test-fullcalendar') return (options: { firstDay?: number }) => { firstDays.push(options.firstDay); return null; };
      if (id === 'test-plugin') return {};
      if (id === 'test-actions') return { listHouseBookingsAction: async () => { throw new Error('Unexpected server call during static render'); } };
      if (id === 'test-editor') return { BookingEditor: () => null };
      return require(id);
    }, loaded, loaded.exports);
    const Calendar = loaded.exports[exportedName] as ComponentType<Record<string, unknown>>;
    renderToStaticMarkup(createElement(Calendar, props));
    assert.deepEqual(firstDays, [0], `${exportedName} must start the week on Sunday`);
  }
});
