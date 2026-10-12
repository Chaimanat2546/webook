import assert from 'node:assert/strict';
import { test } from 'node:test';
import { refreshHouseCalendars } from '../server/services/calendar-sync.ts';
import type { CalendarSyncRepository, SyncSource } from '../server/repositories/calendar-sources.ts';

const source = (id: string): SyncSource => ({ id, listing_id:'house',provider:'airbnb',label:id,enabled:true,
  ical_url_encrypted:'fixture', last_attempted_at:null,last_synced_at:null,next_refresh_at:null,last_error_code:null });
test('claimed sources apply snapshots while a failed source preserves old rows and reports failure', async () => {
  const sources=[source('a'),source('b'),source('locked')];
  const applied:string[]=[],failed:string[]=[];
  const repo: CalendarSyncRepository={
    async list(){return sources;}, async claim(id){return id==='locked'?null:{sourceId:id,token:'lease',source:sources.find(s=>s.id===id)!};},
    async applySnapshot(lease,events){applied.push(lease.sourceId);assert.deepEqual(events,[]);},
    async recordFailure(lease,code){failed.push(lease.sourceId);assert.equal(code,'invalid_ics');},
  };
  const summaries=await refreshHouseCalendars(repo,['house'],'actor',{
    async load(s){if(s.id==='b')throw new Error('invalid_ics');return [];},now:()=>Date.parse('2026-10-09T10:00:00Z'),
  });
  assert.deepEqual(applied,['a']);assert.deepEqual(failed,['b']);assert.equal(summaries.house.stale,true);
});
test('fresh and disabled sources never fetch; source concurrency stays at most three', async () => {
  const sources=Array.from({length:9},(_,i)=>source(`${i}`));
  sources[0].enabled=false;sources[1].last_synced_at='2026-10-09T10:00:00Z';sources[1].next_refresh_at='2026-10-09T10:05:00Z';
  let active=0,max=0,loads=0;
  const repo:CalendarSyncRepository={async list(){return sources;},async claim(id){return {sourceId:id,token:'lease',source:sources.find(s=>s.id===id)!};},async applySnapshot(){},async recordFailure(){}};
  await refreshHouseCalendars(repo,['house'],'actor',{now:()=>Date.parse('2026-10-09T10:01:00Z'),async load(){active++;loads++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,5));active--;return [];}});
  assert.equal(loads,6);assert.ok(max<=3);
});
test('failure cooldown stays stale even while next attempt is delayed', async () => {
  const s=source('error');s.last_synced_at='2026-10-09T09:00:00Z';s.next_refresh_at='2026-10-09T10:01:00Z';s.last_error_code='calendar_timeout';
  const repo:CalendarSyncRepository={async list(){return [s];},async claim(){assert.fail('cooldown must not claim');},async applySnapshot(){},async recordFailure(){}};
  const result=await refreshHouseCalendars(repo,['house'],'actor',{now:()=>Date.parse('2026-10-09T10:00:30Z'),async load(){assert.fail('cooldown must not fetch');}});
  assert.equal(result.house.stale,true);
  assert.ok(!JSON.stringify(result).includes('fixture'));
});
test('fetch uses the URL snapshot returned by the winning claim after a source replacement', async()=>{
  const old=source('a'),replacement={...old,ical_url_encrypted:'new-url'};
  let loaded='';
  const repo:CalendarSyncRepository={async list(){return [old];},async claim(){return {sourceId:'a',token:'lease',source:replacement};},async applySnapshot(){},async recordFailure(){}};
  await refreshHouseCalendars(repo,['house'],'actor',{now:Date.now,async load(claimed){loaded=claimed.ical_url_encrypted;return [];}});
  assert.equal(loaded,'new-url');
});
