-- New events only: no historical backfill and no network requests in this transaction.
begin;

create table public.booking_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_uid uuid not null references auth.users(id) on delete cascade,
  booking_id bigint not null references public.bookings(id) on delete cascade,
  property_id bigint not null,
  created_at timestamptz not null default clock_timestamp(),
  read_at timestamptz,
  unique (recipient_uid, booking_id)
);
create index booking_notifications_inbox_idx on public.booking_notifications(recipient_uid, created_at desc, id desc);
create index booking_notifications_unread_idx on public.booking_notifications(recipient_uid, created_at) where read_at is null;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  recipient_uid uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (length(endpoint) between 12 and 4096),
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create index push_subscriptions_recipient_idx on public.push_subscriptions(recipient_uid);

create table public.booking_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.booking_notifications(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','retry','sending','sent','failed','expired')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  next_attempt_at timestamptz not null default clock_timestamp(),
  lease_token uuid,
  lease_expires_at timestamptz,
  sent_at timestamptz,
  error_code text check (error_code ~ '^[a-z][a-z0-9_]{0,63}$'),
  unique (notification_id, subscription_id),
  check ((status = 'sending') = (lease_token is not null and lease_expires_at is not null))
);
create index booking_push_deliveries_due_idx on public.booking_push_deliveries(next_attempt_at, id) where status in ('pending','retry','sending');
create index booking_push_deliveries_subscription_idx on public.booking_push_deliveries(subscription_id);

alter table public.booking_notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.booking_push_deliveries enable row level security;
-- No browser policies. All reads/writes go through the authenticated server's RPCs.
revoke all on public.booking_notifications, public.push_subscriptions, public.booking_push_deliveries from public, anon, authenticated, service_role;

create function public.booking_notification_actor_allowed(p_actor uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_actor is not null and exists (
    select 1 from public.users u where u.uid = p_actor
      and (u.role_id = 1 or (u.role_id is distinct from 1 and u.dv_id > 0))
  );
$$;

-- Always consult the current user, booking AND listing mapping. Stored recipient IDs
-- describe an event's recipients, never an enduring authorization grant.
create function public.booking_notification_in_scope(p_actor uuid, p_booking bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.users u
    join public.bookings b on b.id = p_booking
    left join public.listings l on l.id = b.listing_id
    where u.uid = p_actor and (
      u.role_id = 1 or (u.role_id is distinct from 1 and u.dv_id > 0
        and u.dv_id = b.houseid and u.dv_id = l.property_id)
    )
  );
$$;

create function public.booking_notification_capture()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status not in ('waiting','confirmed') or new.status is null then return new; end if;
  insert into public.booking_notifications(recipient_uid, booking_id, property_id)
  select distinct u.uid, new.id, coalesce(new.houseid, l.property_id)
  from public.users u
  join auth.users a on a.id = u.uid
  left join public.listings l on l.id = new.listing_id
  where u.uid is not null and coalesce(new.houseid, l.property_id) is not null
    and (u.role_id = 1 or (u.role_id is distinct from 1 and u.dv_id > 0
      and u.dv_id = new.houseid and u.dv_id = l.property_id))
  on conflict (recipient_uid, booking_id) do nothing;

  insert into public.booking_push_deliveries(notification_id, subscription_id)
  select n.id, s.id from public.booking_notifications n
    join public.push_subscriptions s on s.recipient_uid = n.recipient_uid
  where n.booking_id = new.id
  on conflict (notification_id, subscription_id) do nothing;
  return new;
end;
$$;
create trigger booking_notification_insert after insert on public.bookings
  for each row execute function public.booking_notification_capture();

create function public.booking_notification_list(p_actor uuid, p_page integer default 1, p_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_page integer := coalesce(p_page,1);
  v_as_of timestamptz := clock_timestamp();
  v_result jsonb;
begin
  if not public.booking_notification_actor_allowed(p_actor) then
    raise exception 'notification_forbidden' using errcode = '42501';
  end if;
  if v_page < 1 or v_page > 100000 then
    raise exception 'notification_invalid_input' using errcode = '22023';
  end if;
  with scoped as materialized (
    select n.*, b.check_in, b.check_out, b.status, b.calendar_source_id, l.title,
      coalesce(b.updated_at,n.created_at) as booking_updated_at
    from public.booking_notifications n
    join public.bookings b on b.id = n.booking_id
    left join public.listings l on l.id = b.listing_id
    where n.recipient_uid = p_actor
      and public.booking_notification_in_scope(p_actor, n.booking_id)
  ), selected as (
    select * from scoped where p_id is null or id = p_id
    order by created_at desc, id desc limit 20 offset (v_page - 1) * 20
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id::text, 'bookingId', booking_id::text, 'propertyId', property_id::text,
      'title', coalesce(title,''), 'checkIn', coalesce(check_in::text,''),
      'checkOut', coalesce(check_out::text,''), 'status', coalesce(status,''),
      'source', case when calendar_source_id is not null then 'ical' else 'internal' end,
      'createdAt', created_at, 'bookingUpdatedAt', booking_updated_at, 'readAt', read_at
    ) order by created_at desc, id desc) from selected),'[]'::jsonb),
    'unreadCount', (select count(*) from scoped where read_at is null),
    'total', (select count(*) from scoped where p_id is null or id = p_id),
    'page', v_page, 'pageSize', 20, 'asOf', v_as_of
  ) into v_result;
  return v_result;
end;
$$;

create function public.booking_notification_read(p_actor uuid, p_id uuid default null, p_before timestamptz default null)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.booking_notification_actor_allowed(p_actor) then
    raise exception 'notification_forbidden' using errcode = '42501';
  end if;
  if (p_id is null) = (p_before is null) then
    raise exception 'notification_invalid_input' using errcode = '22023';
  end if;
  update public.booking_notifications n set read_at = clock_timestamp()
  where n.recipient_uid = p_actor and n.read_at is null
    and public.booking_notification_in_scope(p_actor,n.booking_id)
    and ((p_id is not null and n.id = p_id)
      or (p_before is not null and n.created_at <= least(p_before,clock_timestamp())));
  return true;
end;
$$;

create function public.booking_push_subscribe(p_actor uuid, p_endpoint text, p_p256dh text, p_auth text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.booking_notification_actor_allowed(p_actor) then
    raise exception 'notification_forbidden' using errcode = '42501';
  end if;
  if p_endpoint is null or length(p_endpoint) not between 12 and 4096
    or p_endpoint !~ '^https://[^[:space:]]+$'
    or p_p256dh is null or p_p256dh !~ '^[A-Za-z0-9_-]{87}$'
    or p_auth is null or p_auth !~ '^[A-Za-z0-9_-]{22}$' then
    raise exception 'notification_invalid_input' using errcode = '22023';
  end if;
  insert into public.push_subscriptions(recipient_uid,endpoint,p256dh,auth)
  values(p_actor,p_endpoint,p_p256dh,p_auth)
  on conflict (endpoint) do update set recipient_uid = excluded.recipient_uid,
    p256dh = excluded.p256dh, auth = excluded.auth, updated_at = clock_timestamp()
  returning id into v_id;
  -- A shared browser belongs to its current account. Never resurrect previous jobs
  -- if this endpoint is transferred away and subsequently transferred back.
  update public.booking_push_deliveries d
  set status = 'failed', error_code = 'subscription_transferred', lease_token = null, lease_expires_at = null
  from public.booking_notifications n
  where d.subscription_id = v_id and n.id = d.notification_id and n.recipient_uid <> p_actor
    and d.status in ('pending','retry','sending');
  return v_id;
end;
$$;

create function public.booking_push_unsubscribe(p_actor uuid, p_endpoint text default null, p_subscription uuid default null)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  -- Cleanup must still work after a role/DV revocation; ownership is sufficient.
  if p_actor is null or not exists(select 1 from public.users where uid = p_actor) then
    raise exception 'notification_forbidden' using errcode = '42501';
  end if;
  if (p_endpoint is null) = (p_subscription is null) then
    raise exception 'notification_invalid_input' using errcode = '22023';
  end if;
  delete from public.push_subscriptions s where s.recipient_uid = p_actor
    and ((p_endpoint is not null and s.endpoint = p_endpoint)
      or (p_subscription is not null and s.id = p_subscription));
  return true;
end;
$$;

create function public.booking_push_claim(p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_now timestamptz := clock_timestamp(); v_result jsonb;
begin
  -- Retire invalid/expired jobs while skipping rows leased by a concurrent caller.
  with invalid as (
    select d.id,
      case when n.created_at <= v_now - interval '24 hours' then 'notification_expired'
        when d.attempt_count >= 5 then 'attempts_exhausted' else 'notification_forbidden' end as reason
    from public.booking_push_deliveries d
    join public.booking_notifications n on n.id = d.notification_id
    join public.push_subscriptions s on s.id = d.subscription_id
    where (d.status in ('pending','retry') or (d.status = 'sending' and d.lease_expires_at <= v_now))
      and (n.created_at <= v_now - interval '24 hours' or d.attempt_count >= 5
        or s.recipient_uid <> n.recipient_uid
        or not public.booking_notification_in_scope(n.recipient_uid,n.booking_id))
    order by d.next_attempt_at, d.id limit 500
    for update of d skip locked
  )
  update public.booking_push_deliveries d set status = 'failed', error_code = i.reason,
    lease_token = null, lease_expires_at = null from invalid i where d.id = i.id;

  with due as (
    select d.id from public.booking_push_deliveries d
    join public.booking_notifications n on n.id = d.notification_id
    join public.push_subscriptions s on s.id = d.subscription_id and s.recipient_uid = n.recipient_uid
    where ((d.status in ('pending','retry') and d.next_attempt_at <= v_now)
      or (d.status = 'sending' and d.lease_expires_at <= v_now))
      and d.attempt_count < 5 and n.created_at > v_now - interval '24 hours'
      and public.booking_notification_in_scope(n.recipient_uid,n.booking_id)
    order by d.next_attempt_at, d.id
    limit greatest(0,least(coalesce(p_limit,50),50))
    for update of d skip locked
  ), leased as (
    update public.booking_push_deliveries d set status = 'sending', attempt_count = d.attempt_count + 1,
      lease_token = gen_random_uuid(), lease_expires_at = v_now + interval '3 minutes'
    from due where d.id = due.id returning d.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id::text, 'leaseToken', d.lease_token::text,
    'notificationId', d.notification_id::text, 'subscriptionId', d.subscription_id::text,
    'endpoint', s.endpoint, 'keys', jsonb_build_object('p256dh',s.p256dh,'auth',s.auth),
    'attempt', d.attempt_count
  )),'[]'::jsonb) into v_result
  from leased d join public.push_subscriptions s on s.id = d.subscription_id;
  return v_result;
end;
$$;

create function public.booking_push_authorize(p_id uuid, p_lease uuid)
returns boolean language sql volatile security definer set search_path = '' as $$
  select exists (
    select 1 from public.booking_push_deliveries d
    join public.booking_notifications n on n.id = d.notification_id
    join public.push_subscriptions s on s.id = d.subscription_id and s.recipient_uid = n.recipient_uid
    where d.id = p_id and d.lease_token = p_lease and d.status = 'sending'
      and d.lease_expires_at > clock_timestamp()
      and n.created_at > clock_timestamp() - interval '24 hours'
      and public.booking_notification_in_scope(n.recipient_uid,n.booking_id)
  );
$$;

create function public.booking_push_complete(p_id uuid, p_lease uuid, p_status text, p_error text default null, p_retry_at timestamptz default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_job public.booking_push_deliveries%rowtype; v_now timestamptz := clock_timestamp(); v_status text;
begin
  if p_status is null or p_status not in ('sent','retry','failed','expired')
    or (p_error is not null and p_error !~ '^[a-z][a-z0-9_]{0,63}$')
    or (p_status = 'retry' and p_retry_at is null) then
    raise exception 'notification_invalid_input' using errcode = '22023';
  end if;
  select * into v_job from public.booking_push_deliveries
  where id = p_id and status = 'sending' and lease_token = p_lease and lease_expires_at > v_now
  for update;
  if not found then return false; end if;
  if not exists (
    select 1 from public.booking_notifications n join public.push_subscriptions s on s.id = v_job.subscription_id
    where n.id = v_job.notification_id and s.recipient_uid = n.recipient_uid
      and public.booking_notification_in_scope(n.recipient_uid,n.booking_id)
  ) then
    update public.booking_push_deliveries set status = 'failed', error_code = 'notification_forbidden',
      lease_token = null, lease_expires_at = null where id = p_id;
    return false;
  end if;
  if p_status = 'expired' then
    delete from public.push_subscriptions where id = v_job.subscription_id;
    return true;
  end if;
  v_status := case when p_status = 'retry' and (
    v_job.attempt_count >= 5 or exists(select 1 from public.booking_notifications
      where id = v_job.notification_id and created_at <= v_now - interval '24 hours')
  ) then 'failed' else p_status end;
  update public.booking_push_deliveries set status = v_status,
    next_attempt_at = case when v_status = 'retry' then greatest(p_retry_at,
      v_now + (interval '1 minute' * power(2,v_job.attempt_count - 1))) else next_attempt_at end,
    sent_at = case when v_status = 'sent' then v_now else sent_at end,
    error_code = p_error, lease_token = null, lease_expires_at = null where id = p_id;
  return true;
end;
$$;

-- Explicit signatures prevent new overloads or PUBLIC's default EXECUTE from
-- accidentally exposing these privileged actor-taking APIs to browsers.
revoke all on function public.booking_notification_actor_allowed(uuid) from public, anon, authenticated, service_role;
revoke all on function public.booking_notification_in_scope(uuid,bigint) from public, anon, authenticated, service_role;
revoke all on function public.booking_notification_capture() from public, anon, authenticated, service_role;
revoke all on function public.booking_notification_list(uuid,integer,uuid) from public, anon, authenticated;
revoke all on function public.booking_notification_read(uuid,uuid,timestamptz) from public, anon, authenticated;
revoke all on function public.booking_push_subscribe(uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.booking_push_unsubscribe(uuid,text,uuid) from public, anon, authenticated;
revoke all on function public.booking_push_claim(integer) from public, anon, authenticated;
revoke all on function public.booking_push_authorize(uuid,uuid) from public, anon, authenticated;
revoke all on function public.booking_push_complete(uuid,uuid,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.booking_notification_list(uuid,integer,uuid) to service_role;
grant execute on function public.booking_notification_read(uuid,uuid,timestamptz) to service_role;
grant execute on function public.booking_push_subscribe(uuid,text,text,text) to service_role;
grant execute on function public.booking_push_unsubscribe(uuid,text,uuid) to service_role;
grant execute on function public.booking_push_claim(integer) to service_role;
grant execute on function public.booking_push_authorize(uuid,uuid) to service_role;
grant execute on function public.booking_push_complete(uuid,uuid,text,text,timestamptz) to service_role;

commit;
