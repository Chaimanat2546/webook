import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement, ButtonHTMLAttributes } from 'react';

test('shared date cell is read-only for iCal, including past dates and exclusive checkout', async () => {
  const result = await build({entryPoints:['components/admin/houses/bookings/booking-date-cell.tsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external'});
  const loaded={exports:{} as Record<string,unknown>};
  new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),loaded,loaded.exports);
  const Cell=loaded.exports.BookingDateCell as (props:Record<string,unknown>)=>ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>;
  const changes:string[][]=[];
  const props={rows:[],day:'2026-10-09',dayNumber:'9',today:'2026-10-20',start:'2026-10-09',end:'2026-10-10',ready:true,readOnly:true,onChange:(...dates:string[])=>changes.push(dates)};
  const start=Cell(props);
  assert.equal(start.props.disabled,true);
  start.props.onClick?.({} as never);
  assert.deepEqual(changes,[]);
  assert.match(renderToStaticMarkup(start),/data-range="start"/);
  assert.match(renderToStaticMarkup(start),/aria-label="2026-10-09 คืนที่เข้าพักของรายการนี้ อ่านอย่างเดียว"/);
  assert.doesNotMatch(renderToStaticMarkup(start),/เลือกวันเช็กอิน|วันที่ผ่านมาแล้ว/);
  const end=Cell({...props,day:'2026-10-10',dayNumber:'10'});
  assert.doesNotMatch(renderToStaticMarkup(end),/data-range=/);
  const cancelled=Cell({...props,selected:false});
  assert.doesNotMatch(renderToStaticMarkup(cancelled),/data-range=/);

  const normal=Cell({...props,readOnly:false,today:'2026-10-01',start:'',end:''});
  assert.equal(normal.props.disabled,false);
  normal.props.onClick?.({} as never);
  assert.deepEqual(changes,[['2026-10-09','']]);
});
