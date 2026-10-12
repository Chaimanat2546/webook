import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CalendarEvent, CalendarProvider, CalendarSourceSummary } from '../../lib/ical-calendar.ts';
import { record } from '../../lib/house-bookings.ts';

export interface SyncSource extends CalendarSourceSummary { ical_url_encrypted: string }
export interface Lease { sourceId: string; token: string; source:SyncSource }
export interface CalendarSyncRepository {
  list(listingIds: string[]): Promise<SyncSource[]>;
  claim(sourceId: string, actorId: string): Promise<Lease | null>;
  applySnapshot(lease: Lease, events: CalendarEvent[], actorId: string): Promise<void>;
  recordFailure(lease: Lease, code: string, actorId: string): Promise<void>;
}
function required(value: unknown): string { if(typeof value !== 'string') throw new Error('calendar_invalid_data');return value; }
function nullable(value: unknown): string|null { return value==null?null:required(value); }
export function createCalendarSourcesRepository(client: SupabaseClient) {
  return {
    async list(listingIds: string[]): Promise<SyncSource[]> {
      if(!listingIds.length)return [];
      const {data,error}=await client.from('property_calendar_sources')
        .select('id,listing_id,provider,label,enabled,ical_url_encrypted,last_attempted_at,last_synced_at,next_refresh_at,last_error_code')
        .in('listing_id',listingIds).order('created_at').limit(1000);
      if(error)throw new Error('calendar_unavailable');
      return (data??[]).map((value:unknown)=>{
        const r=record(value),provider=required(r.provider);
        if(!['airbnb','agoda','booking_com','other'].includes(provider)||typeof r.enabled!=='boolean')throw new Error('calendar_invalid_data');
        return {id:required(r.id),listing_id:required(r.listing_id),provider:provider as CalendarProvider,label:required(r.label),enabled:r.enabled,
          ical_url_encrypted:required(r.ical_url_encrypted),last_attempted_at:nullable(r.last_attempted_at),last_synced_at:nullable(r.last_synced_at),next_refresh_at:nullable(r.next_refresh_at),last_error_code:nullable(r.last_error_code)};
      });
    },
    async claim(sourceId:string,actorId:string):Promise<Lease|null>{
      const {data,error}=await client.rpc('calendar_claim_source',{p_source:sourceId,p_actor:actorId});
      if(error)throw new Error('calendar_sync_failed');
      if(!data)return null;
      const result=record(data),r=record(result.source),provider=required(r.provider);
      if(!['airbnb','agoda','booking_com','other'].includes(provider)||typeof r.enabled!=='boolean')throw new Error('calendar_invalid_data');
      const source:SyncSource={id:required(r.id),listing_id:required(r.listing_id),provider:provider as CalendarProvider,label:required(r.label),enabled:r.enabled,
        ical_url_encrypted:required(r.ical_url_encrypted),last_attempted_at:nullable(r.last_attempted_at),last_synced_at:nullable(r.last_synced_at),next_refresh_at:nullable(r.next_refresh_at),last_error_code:nullable(r.last_error_code)};
      return {sourceId,token:required(result.token),source};
    },
    async applySnapshot(lease:Lease,events:CalendarEvent[],actorId:string):Promise<void>{
      const {error}=await client.rpc('calendar_apply_snapshot',{p_source:lease.sourceId,p_token:lease.token,p_actor:actorId,p_events:events});
      if(error)throw new Error('calendar_sync_failed');
    },
    async recordFailure(lease:Lease,code:string,actorId:string):Promise<void>{
      const {error}=await client.rpc('calendar_record_failure',{p_source:lease.sourceId,p_token:lease.token,p_actor:actorId,p_code:code});
      if(error)throw new Error('calendar_sync_failed');
    },
    async add(listingId:string,label:string,payload:string):Promise<void>{
      const {error}=await client.from('property_calendar_sources').insert({listing_id:listingId,provider:'airbnb',label,ical_url_encrypted:payload});
      if(error)throw new Error('calendar_source_save_failed');
    },
    async update(sourceId:string,listingId:string,actorId:string,label:string,enabled:boolean,payload:string|null):Promise<void>{
      const {error}=await client.rpc('calendar_update_source',{p_source:sourceId,p_listing:listingId,p_actor:actorId,p_label:label,p_enabled:enabled,p_encrypted_url:payload});
      if(error)throw new Error('calendar_source_save_failed');
    },
  };
}
