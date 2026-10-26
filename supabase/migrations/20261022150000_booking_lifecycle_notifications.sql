-- Lifecycle notifications are captured in the booking transaction, with no historical event backfill.
begin;

alter table public.booking_notifications add column event_type text not null default 'booking_created'
  check (event_type in ('booking_created','payment_succeeded','booking_cancelled','payment_expired'));
alter table public.booking_notifications drop constraint booking_notifications_recipient_uid_booking_id_key;
create unique index booking_notifications_created_once_idx
  on public.booking_notifications(recipient_uid,booking_id) where event_type = 'booking_created';

-- Explicit provenance distinguishes the expiry sweep from manual cancellation,
-- even when an operator cancels after the deadline. Client RPC allowlists do not accept it.
alter table public.bookings add column cancellation_reason text
  check (cancellation_reason in ('manual','payment_expired'));

create function public.booking_cancellation_provenance()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status is distinct from new.status then
    if new.status = 'cancelled' and old.status in ('waiting','confirmed') then
      if new.cancellation_reason = 'payment_expired' and old.status = 'waiting'
        and old.payment_expires_at is not null and old.payment_expires_at <= clock_timestamp() then
        new.cancellation_reason := 'payment_expired';
      else new.cancellation_reason := 'manual';
      end if;
    else new.cancellation_reason := null;
    end if;
  end if;
  return new;
end;
$$;
create trigger booking_cancellation_provenance_update before update of status on public.bookings
  for each row execute function public.booking_cancellation_provenance();

create or replace function public.booking_notification_capture()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_event text;
begin
  if tg_op = 'INSERT' then
    if new.status not in ('waiting','confirmed') or new.status is null then return new; end if;
    v_event := 'booking_created';
  elsif old.status is not distinct from new.status then return new;
  elsif old.status = 'waiting' and new.status = 'confirmed' and new.calendar_source_id is null then
    v_event := 'payment_succeeded';
  elsif old.status in ('waiting','confirmed') and new.status = 'cancelled' then
    v_event := case when new.cancellation_reason = 'payment_expired' then 'payment_expired' else 'booking_cancelled' end;
  else return new;
  end if;
  with captured as (
  insert into public.booking_notifications(recipient_uid, booking_id, property_id, event_type)
  select distinct u.uid, new.id, coalesce(new.houseid, l.property_id), v_event
  from public.users u
  join auth.users a on a.id = u.uid
  left join public.listings l on l.id = new.listing_id
  where u.uid is not null and coalesce(new.houseid, l.property_id) is not null
    and (u.role_id = 1 or (u.role_id is distinct from 1 and u.dv_id > 0
      and u.dv_id = new.houseid and u.dv_id = l.property_id))
  on conflict do nothing
  returning id, recipient_uid
  )
  insert into public.booking_push_deliveries(notification_id, subscription_id)
  select n.id, s.id from captured n
    join public.push_subscriptions s on s.recipient_uid = n.recipient_uid
  on conflict (notification_id, subscription_id) do nothing;
  return new;
end;
$$;

create or replace function public.booking_notification_list(p_actor uuid, p_page integer default 1, p_id uuid default null)
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
      'eventType', event_type,
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

create or replace function public.booking_push_claim(p_limit integer default 50)
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
    'eventType', n.event_type,
    'endpoint', s.endpoint, 'keys', jsonb_build_object('p256dh',s.p256dh,'auth',s.auth),
    'attempt', d.attempt_count
  )),'[]'::jsonb) into v_result
  from leased d join public.push_subscriptions s on s.id = d.subscription_id
    join public.booking_notifications n on n.id = d.notification_id;
  return v_result;
end;
$$;

create or replace function public.admin_expire_waiting_bookings(p_limit integer default 500)
returns integer language plpgsql set search_path to 'pg_catalog', 'public' as $$
declare v_count integer;
begin
  if p_limit is null or p_limit < 1 or p_limit > 500 then raise exception 'booking_invalid_input'; end if;
  with due as (
    select id from public.bookings
    where status = 'waiting' and payment_expires_at <= clock_timestamp()
    order by payment_expires_at, id limit p_limit for update skip locked
  ), expired as (
    update public.bookings b set status = 'cancelled', cancellation_reason = 'payment_expired', payment_expires_at = null, updated_at = clock_timestamp()
    from due where b.id = due.id
      and b.status = 'waiting' and b.payment_expires_at <= clock_timestamp()
    returning b.id
  ) select count(*)::integer into v_count from expired;
  return v_count;
end;
$$;

create trigger booking_notification_status_update after update of status on public.bookings
  for each row execute function public.booking_notification_capture();

revoke all on function public.booking_cancellation_provenance() from public, anon, authenticated, service_role;
revoke all on function public.booking_notification_capture() from public, anon, authenticated, service_role;
revoke all on function public.booking_notification_list(uuid,integer,uuid) from public, anon, authenticated;
revoke all on function public.booking_push_claim(integer) from public, anon, authenticated;
revoke all on function public.admin_expire_waiting_bookings(integer) from public, anon, authenticated;
grant execute on function public.booking_notification_list(uuid,integer,uuid) to service_role;
grant execute on function public.booking_push_claim(integer) to service_role;
grant execute on function public.admin_expire_waiting_bookings(integer) to service_role;
notify pgrst, 'reload schema';
commit;
