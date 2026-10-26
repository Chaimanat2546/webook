create table public.login_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  logged_in_at timestamptz not null,
  created_at timestamptz not null default now(),
  ip_address inet,
  os text not null default 'unknown' check (length(os) between 1 and 100),
  browser text not null default 'unknown' check (length(browser) between 1 and 100),
  device_type text not null default 'unknown' check (device_type in ('desktop','mobile','tablet','unknown')),
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  location_status text not null default 'pending' check (location_status in ('pending','success','skipped','denied','unavailable','timeout','unsupported')),
  location_captured_at timestamptz,
  location_received_at timestamptz,
  unique (user_id, session_id),
  constraint login_history_coordinates check (
    (location_status = 'success' and latitude is not null and longitude is not null and accuracy_m is not null
     and latitude between -90 and 90 and longitude between -180 and 180
     and accuracy_m >= 0 and accuracy_m < 'Infinity'::double precision
     and location_captured_at is not null and location_received_at is not null)
    or
    (location_status <> 'success' and latitude is null and longitude is null
     and accuracy_m is null and location_captured_at is null)
  )
);
create index login_history_user_time_idx on public.login_history(user_id, logged_in_at desc, id desc);
create index login_history_time_idx on public.login_history(logged_in_at desc, id desc);

create function login_history_private.is_root(p_user uuid)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select count(*) = 1 and coalesce(bool_and(role_id = 1), false) from public.users where uid = p_user
$$;
revoke all on function login_history_private.is_root(uuid) from public;
grant usage on schema login_history_private to authenticated;
grant execute on function login_history_private.is_root(uuid) to authenticated;
alter table public.login_history enable row level security;
revoke all on public.login_history from public, anon, authenticated;
grant select on public.login_history to authenticated;
grant select, insert, update, delete on public.login_history to service_role;
create policy login_history_read on public.login_history for select to authenticated
using (user_id = (select auth.uid()) or (select login_history_private.is_root(auth.uid())));

create function public.login_history_session_active(p_user uuid, p_session uuid)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select exists(select 1 from auth.sessions where id = p_session and user_id = p_user)
$$;

create function public.login_history_record(p_user uuid,p_session uuid,p_logged_in_at timestamptz,
  p_ip inet,p_os text,p_browser text,p_device text)
returns public.login_history language plpgsql security definer set search_path = pg_catalog as $$
declare result public.login_history;
begin
  if not public.login_history_session_active(p_user,p_session) then
    raise exception 'inactive_session' using errcode='28000';
  end if;
  insert into public.login_history(user_id,session_id,logged_in_at,ip_address,os,browser,device_type)
  values(p_user,p_session,p_logged_in_at,p_ip,p_os,p_browser,p_device)
  on conflict(user_id,session_id) do nothing;
  select * into strict result from public.login_history where user_id=p_user and session_id=p_session;
  return result;
end;
$$;

create function public.login_history_current(p_user uuid,p_session uuid)
returns setof public.login_history language sql stable security definer set search_path = pg_catalog as $$
  select * from public.login_history where user_id=p_user and session_id=p_session
  and public.login_history_session_active(p_user,p_session)
$$;

create function public.login_history_attach(p_user uuid,p_session uuid,p_history uuid,p_status text,
  p_latitude double precision,p_longitude double precision,p_accuracy double precision,p_captured_at timestamptz)
returns public.login_history language plpgsql security definer set search_path = pg_catalog as $$
declare result public.login_history;
begin
  -- A revoked session and a location update cannot race past each other.
  perform 1 from auth.sessions where id=p_session and user_id=p_user for key share;
  if not found then raise exception 'inactive_session' using errcode='28000'; end if;
  select * into result from public.login_history
    where id=p_history and user_id=p_user and session_id=p_session for update;
  if not found then raise exception 'history_not_found' using errcode='P0002'; end if;
  if result.logged_in_at < now()-interval '10 minutes' then
    raise exception 'history_expired' using errcode='P0001';
  end if;
  if p_status is null or p_status not in ('success','skipped','denied','unavailable','timeout','unsupported') then
    raise exception 'invalid_location' using errcode='22023';
  end if;
  if p_status='success' and (p_captured_at is null or p_captured_at < result.logged_in_at or p_captured_at > now()+interval '60 seconds') then
    raise exception 'invalid_capture_time' using errcode='22023';
  end if;
  if result.location_status <> 'pending' then
    if result.location_status=p_status and result.latitude is not distinct from p_latitude
       and result.longitude is not distinct from p_longitude and result.accuracy_m is not distinct from p_accuracy
       and result.location_captured_at is not distinct from p_captured_at then return result; end if;
    raise exception 'history_already_reported' using errcode='P0001';
  end if;
  update public.login_history set location_status=p_status,latitude=p_latitude,longitude=p_longitude,
    accuracy_m=p_accuracy,location_captured_at=p_captured_at,location_received_at=now()
    where id=result.id returning * into result;
  return result;
end;
$$;

create function public.login_history_list(p_actor uuid,p_search text,p_from timestamptz,p_to timestamptz,p_page integer,p_size integer)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $$
declare root boolean := login_history_private.is_root(p_actor); result jsonb;
begin
  if p_actor is null then raise exception 'unauthenticated' using errcode='28000'; end if;
  if not root and coalesce(p_search,'') <> '' then raise exception 'history_forbidden' using errcode='42501'; end if;
  if p_page is null or p_page not between 1 and 1000000 or p_size is null or p_size not between 1 and 100
     or (p_from is not null and p_to is not null and p_from >= p_to) then
    raise exception 'invalid_filter' using errcode='22023';
  end if;
  with filtered as materialized (
    select h.*, profile.name as display_name, profile.username, profile.email
    from public.login_history h
    left join lateral (
      select min(u.name) as name,min(u.username) as username,min(u.email) as email
      from public.users u where u.uid=h.user_id having count(*)=1
    ) profile on true
    where (root or h.user_id=p_actor) and (p_from is null or h.logged_in_at >= p_from)
      and (p_to is null or h.logged_in_at < p_to)
      and (coalesce(p_search,'')='' or position(lower(p_search) in lower(concat_ws(' ',profile.name,profile.username,profile.email))) > 0)
  ), page as (
    select * from filtered order by logged_in_at desc,id desc limit p_size offset ((p_page-1)*p_size)
  )
  select jsonb_build_object('total',(select count(*) from filtered),
    'entries',coalesce((select jsonb_agg(to_jsonb(page)-'session_id' order by logged_in_at desc,id desc) from page),'[]'::jsonb)) into result;
  return result;
end;
$$;

create function public.login_history_purge()
returns integer language plpgsql security definer set search_path = pg_catalog as $$
declare removed integer;
begin
  with expired as (
    select id from public.login_history where logged_in_at < now()-interval '90 days'
    order by logged_in_at,id limit 1000 for update skip locked
  ) delete from public.login_history where id in (select id from expired);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.login_history_session_active(uuid,uuid), public.login_history_record(uuid,uuid,timestamptz,inet,text,text,text),
  public.login_history_current(uuid,uuid), public.login_history_attach(uuid,uuid,uuid,text,double precision,double precision,double precision,timestamptz),
  public.login_history_list(uuid,text,timestamptz,timestamptz,integer,integer), public.login_history_purge() from public,anon,authenticated;
grant execute on function public.login_history_session_active(uuid,uuid), public.login_history_record(uuid,uuid,timestamptz,inet,text,text,text),
  public.login_history_current(uuid,uuid), public.login_history_attach(uuid,uuid,uuid,text,double precision,double precision,double precision,timestamptz),
  public.login_history_list(uuid,text,timestamptz,timestamptz,integer,integer), public.login_history_purge() to service_role;
