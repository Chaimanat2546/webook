begin;

create table public.property_calendar_sources (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  provider text not null check (provider in ('airbnb','agoda','booking_com','other')),
  label text not null check (length(btrim(label)) between 1 and 120),
  ical_url_encrypted text not null check (length(ical_url_encrypted) between 1 and 8192),
  enabled boolean not null default true,
  last_attempted_at timestamptz,
  last_synced_at timestamptz,
  next_refresh_at timestamptz,
  last_error_code text check (last_error_code is null or last_error_code in
    ('calendar_timeout','calendar_http_error','calendar_fetch_failed','invalid_ics','unsupported_ics',
     'ical_too_large','calendar_secret_invalid','calendar_secret_unconfigured','calendar_sync_failed','invalid_calendar_url')),
  sync_lease_token uuid,
  sync_lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id,listing_id),
  check ((sync_lease_token is null) = (sync_lease_expires_at is null))
);
create index property_calendar_sources_house_idx on public.property_calendar_sources(listing_id,enabled);
alter table public.property_calendar_sources enable row level security;
revoke all on public.property_calendar_sources from anon,authenticated;
grant select,insert,update on public.property_calendar_sources to service_role;

alter table public.bookings add column calendar_source_id uuid, add column external_uid text;
alter table public.bookings add constraint bookings_calendar_source_house_fkey
  foreign key (calendar_source_id,listing_id) references public.property_calendar_sources(id,listing_id) on delete restrict;
alter table public.bookings add constraint bookings_calendar_identity_check
  check ((calendar_source_id is null and external_uid is null) or
    (calendar_source_id is not null and external_uid is not null and length(btrim(external_uid)) between 1 and 1024));
create unique index bookings_calendar_uid_idx on public.bookings(calendar_source_id,external_uid) where calendar_source_id is not null;

-- Preserve the verified internal overlap rule while allowing external snapshots
-- to represent conflicts rather than discarding the provider's data.
alter table public.bookings drop constraint no_overlapping_bookings;
alter table public.bookings add constraint no_overlapping_bookings exclude using gist
  (listing_id with =,daterange(check_in,check_out,'[)') with &&)
  where (calendar_source_id is null and status not in ('cancelled','rejected'));

create function public.calendar_assert_actor(p_actor uuid, p_manage boolean default false)
returns void language plpgsql set search_path = pg_catalog,public as $$
begin
  if not exists (select 1 from public.users where uid=p_actor
    and allow_tools->'allow_booking'='true'::jsonb and (not p_manage or role_id=1)) then
    raise exception 'calendar_forbidden' using errcode='42501';
  end if;
end $$;

create function public.calendar_guard_booking() returns trigger language plpgsql
set search_path = pg_catalog,public as $$
declare v_check_external boolean;
begin
  if ((tg_op <> 'INSERT' and old.calendar_source_id is not null)
      or (tg_op <> 'DELETE' and new.calendar_source_id is not null))
    and current_setting('webook.calendar_write',true) is distinct from 'allowed' then
    raise exception 'calendar_booking_readonly' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; end if;
  -- Serialize availability changes per listing. Import may reveal a conflict
  -- with an existing stay, but a new/moved internal stay cannot ignore it.
  perform pg_advisory_xact_lock(hashtextextended('calendar-listing:'||new.listing_id::text,0));
  v_check_external:=tg_op='INSERT';
  if tg_op='UPDATE' then
    v_check_external:=(old.listing_id,old.check_in,old.check_out) is distinct from
      (new.listing_id,new.check_in,new.check_out) or old.status in ('cancelled','rejected');
  end if;
  if new.calendar_source_id is null and new.status not in ('cancelled','rejected') and v_check_external
    and exists (select 1 from public.bookings b where b.listing_id=new.listing_id
      and b.calendar_source_id is not null and b.status not in ('cancelled','rejected')
      and b.check_in<new.check_out and b.check_out>new.check_in) then
    raise exception 'calendar_booking_conflict' using errcode='23P01';
  end if;
  if new.calendar_source_id is not null and not exists (
    select 1 from public.property_calendar_sources s join public.listings l on l.id=s.listing_id
    where s.id=new.calendar_source_id and l.id=new.listing_id and l.property_id=new.houseid
      and s.provider=new.booking_type
      and new.customer_id is null and new.agent_id is null and new.payment_expires_at is null
      and new.status in ('confirmed','cancelled') and new.check_out>new.check_in
  ) then raise exception 'calendar_invalid_booking'; end if;
  return new;
end $$;
create trigger calendar_guard_booking before insert or update or delete on public.bookings
  for each row execute function public.calendar_guard_booking();

create function public.calendar_claim_source(p_source uuid,p_actor uuid)
returns jsonb language plpgsql set search_path = pg_catalog,public as $$
declare v_token uuid:=gen_random_uuid(); v_source public.property_calendar_sources%rowtype;
begin
  perform public.calendar_assert_actor(p_actor);
  update public.property_calendar_sources set sync_lease_token=v_token,
    sync_lease_expires_at=clock_timestamp()+interval '30 seconds',last_attempted_at=clock_timestamp(),last_error_code=null
  where id=p_source and enabled and (next_refresh_at is null or next_refresh_at<=clock_timestamp())
    and (sync_lease_expires_at is null or sync_lease_expires_at<=clock_timestamp()) returning * into v_source;
  if not found then return null; end if;
  return jsonb_build_object('token',v_token,'source',to_jsonb(v_source));
end $$;

create function public.calendar_apply_snapshot(p_source uuid,p_token uuid,p_actor uuid,p_events jsonb)
returns void language plpgsql set search_path = pg_catalog,public as $$
declare s public.property_calendar_sources%rowtype; v_house bigint; e jsonb;
  v_uid text; v_start date; v_end date; v_write text; v_sub text;
begin
  perform public.calendar_assert_actor(p_actor);
  select * into s from public.property_calendar_sources where id=p_source for update;
  if not found or not s.enabled or s.sync_lease_token is distinct from p_token
    or p_token is null or s.sync_lease_expires_at<=clock_timestamp() then raise exception 'calendar_stale_lease'; end if;
  if jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events)>5000 then raise exception 'invalid_ics'; end if;
  if exists (select 1 from jsonb_array_elements(p_events) x group by x->>'uid' having count(*)>1) then raise exception 'invalid_ics'; end if;
  select property_id into v_house from public.listings where id=s.listing_id;
  if v_house is null then raise exception 'calendar_house_not_found'; end if;
  v_write:=current_setting('webook.calendar_write',true); v_sub:=current_setting('request.jwt.claim.sub',true);
  perform set_config('webook.calendar_write','allowed',true);
  perform set_config('request.jwt.claim.sub',p_actor::text,true);
  for e in select value from jsonb_array_elements(p_events) loop
    v_uid:=e->>'uid';
    if jsonb_typeof(e) is distinct from 'object' or v_uid is null or length(btrim(v_uid)) not between 1 and 1024
      or e->>'status' is null or e->>'status' not in ('active','cancelled') then raise exception 'invalid_ics'; end if;
    if e->>'status'='cancelled' then
      update public.bookings set status='cancelled',updated_at=clock_timestamp()
        where calendar_source_id=p_source and external_uid=v_uid and status is distinct from 'cancelled';
    else
      if coalesce(e->>'start','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(e->>'endExclusive','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid_ics'; end if;
      v_start:=(e->>'start')::date; v_end:=(e->>'endExclusive')::date;
      if v_end<=v_start then raise exception 'invalid_ics'; end if;
      insert into public.bookings(booking_code,listing_id,houseid,booking_type,status,check_in,check_out,
        quantity,calendar_source_id,external_uid,created_by)
      values('ICAL-'||gen_random_uuid()::text,s.listing_id,v_house,s.provider,'confirmed',v_start,v_end,v_end-v_start,p_source,v_uid,p_actor)
      on conflict (calendar_source_id,external_uid) where calendar_source_id is not null
      do update set check_in=excluded.check_in,check_out=excluded.check_out,quantity=excluded.quantity,
        status='confirmed',updated_at=clock_timestamp()
      where (bookings.check_in,bookings.check_out,bookings.status,bookings.quantity)
        is distinct from (excluded.check_in,excluded.check_out,excluded.status,excluded.quantity);
    end if;
  end loop;
  update public.bookings b set status='cancelled',updated_at=clock_timestamp()
    where calendar_source_id=p_source and status is distinct from 'cancelled'
      and not exists (select 1 from jsonb_array_elements(p_events) snapshot_event where snapshot_event->>'uid'=b.external_uid);
  update public.property_calendar_sources set last_synced_at=clock_timestamp(),
    next_refresh_at=clock_timestamp()+interval '300 seconds',last_error_code=null,sync_lease_token=null,sync_lease_expires_at=null where id=p_source;
  perform set_config('webook.calendar_write',coalesce(v_write,''),true);
  perform set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
end $$;

create function public.calendar_record_failure(p_source uuid,p_token uuid,p_actor uuid,p_code text)
returns void language plpgsql set search_path = pg_catalog,public as $$
begin
  perform public.calendar_assert_actor(p_actor);
  update public.property_calendar_sources set last_error_code=p_code,
    next_refresh_at=clock_timestamp()+interval '60 seconds',sync_lease_token=null,sync_lease_expires_at=null
    where id=p_source and sync_lease_token=p_token and sync_lease_expires_at>clock_timestamp();
end $$;

create function public.calendar_update_source(p_source uuid,p_listing uuid,p_actor uuid,p_label text,p_enabled boolean,p_encrypted_url text)
returns void language plpgsql set search_path = pg_catalog,public as $$
declare s public.property_calendar_sources%rowtype; v_write text; v_sub text; v_reset boolean;
begin
  perform public.calendar_assert_actor(p_actor,true);
  select * into s from public.property_calendar_sources where id=p_source and listing_id=p_listing for update;
  if not found then raise exception 'calendar_source_not_found'; end if;
  if p_enabled is null then raise exception 'calendar_invalid_input'; end if;
  v_reset:=s.enabled is distinct from p_enabled or p_encrypted_url is not null;
  update public.property_calendar_sources set label=btrim(p_label),enabled=p_enabled,
    ical_url_encrypted=coalesce(p_encrypted_url,ical_url_encrypted),
    next_refresh_at=case when v_reset then null else next_refresh_at end,
    last_synced_at=case when p_encrypted_url is not null then null else last_synced_at end,
    last_error_code=case when v_reset then null else last_error_code end,
    sync_lease_token=case when v_reset then null else sync_lease_token end,
    sync_lease_expires_at=case when v_reset then null else sync_lease_expires_at end where id=p_source;
  if not p_enabled or p_encrypted_url is not null then
    v_write:=current_setting('webook.calendar_write',true); v_sub:=current_setting('request.jwt.claim.sub',true);
    perform set_config('webook.calendar_write','allowed',true); perform set_config('request.jwt.claim.sub',p_actor::text,true);
    update public.bookings set status='cancelled',updated_at=clock_timestamp() where calendar_source_id=p_source and status is distinct from 'cancelled';
    perform set_config('webook.calendar_write',coalesce(v_write,''),true); perform set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
  end if;
end $$;

revoke all on function public.calendar_assert_actor(uuid,boolean),public.calendar_guard_booking(),
  public.calendar_claim_source(uuid,uuid),public.calendar_apply_snapshot(uuid,uuid,uuid,jsonb),
  public.calendar_record_failure(uuid,uuid,uuid,text),public.calendar_update_source(uuid,uuid,uuid,text,boolean,text)
  from public,anon,authenticated;
grant execute on function public.calendar_assert_actor(uuid,boolean),public.calendar_claim_source(uuid,uuid),
  public.calendar_apply_snapshot(uuid,uuid,uuid,jsonb),public.calendar_record_failure(uuid,uuid,uuid,text),
  public.calendar_update_source(uuid,uuid,uuid,text,boolean,text) to service_role;

-- Amend the verified reporting base without replacing unrelated report logic.
do $$
declare v_definition text; v_anchor text:='where (v_admin or b.houseid=v_property)';
begin
  select pg_get_functiondef('public.dashboard_report(uuid,jsonb)'::regprocedure) into v_definition;
  if strpos(v_definition,v_anchor)=0 then raise exception 'calendar_dashboard_definition_mismatch'; end if;
  execute replace(v_definition,v_anchor,v_anchor||' and b.calendar_source_id is null');
end $$;
commit;
