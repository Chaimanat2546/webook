import 'server-only';
import type { CalendarEvent, CalendarSourceSummary, CalendarSyncSummary } from '../../lib/ical-calendar.ts';
import type { CalendarSyncRepository, SyncSource } from '../repositories/calendar-sources.ts';
import { decryptSourceUrl } from '../calendar/source-secret.ts';
import { fetchIcal } from '../calendar/fetch-ical.ts';
import { parseIcal } from '../calendar/parse-ical.ts';

export function calendarSourceSummary(source:SyncSource):CalendarSourceSummary {
  const {id,listing_id,provider,label,enabled,last_attempted_at,last_synced_at,next_refresh_at,last_error_code}=source;
  return {id,listing_id,provider,label,enabled,last_attempted_at,last_synced_at,next_refresh_at,last_error_code};
}
interface SyncDependencies { now:()=>number; load:(source:SyncSource)=>Promise<CalendarEvent[]> }
const defaults:SyncDependencies={now:Date.now,async load(source){
  if(source.provider!=='airbnb')throw new Error('unsupported_ics');
  return parseIcal(await fetchIcal(await decryptSourceUrl(source.ical_url_encrypted)));
}};
const codes=['calendar_timeout','calendar_http_error','calendar_fetch_failed','invalid_ics','unsupported_ics','ical_too_large','calendar_secret_invalid','calendar_secret_unconfigured','invalid_calendar_url'];

export async function refreshHouseCalendars(repository:CalendarSyncRepository,listingIds:string[],actorId:string,deps:SyncDependencies=defaults):Promise<Record<string,CalendarSyncSummary>> {
  const sources=await repository.list(listingIds),now=deps.now();
  // Six attempts per action bounds network work at two waves of three fetches.
  const candidates=sources.filter(s=>s.enabled&&(!s.next_refresh_at||Date.parse(s.next_refresh_at)<=now))
    .sort((a,b)=>(a.last_attempted_at?Date.parse(a.last_attempted_at):0)-(b.last_attempted_at?Date.parse(b.last_attempted_at):0)).slice(0,6);
  let index=0;
  await Promise.all(Array.from({length:Math.min(3,candidates.length)},async()=>{
    while(index<candidates.length){
      const source=candidates[index++],lease=await repository.claim(source.id,actorId);
      if(!lease)continue;
      try {await repository.applySnapshot(lease,await deps.load(lease.source),actorId);}
      catch(error){const message=error instanceof Error?error.message:'';await repository.recordFailure(lease,codes.includes(message)?message:'calendar_sync_failed',actorId);}
    }
  }));
  const fresh=await repository.list(listingIds),result:Record<string,CalendarSyncSummary>={};
  for(const id of listingIds){
    const selected=fresh.filter(s=>s.listing_id===id);
    result[id]={sources:selected.map(calendarSourceSummary),stale:selected.some(s=>s.enabled&&(!s.last_synced_at||deps.now()-Date.parse(s.last_synced_at)>=300_000||!!s.last_error_code))};
  }
  return result;
}
