-- Include only the captured house DV alongside the allowlisted Push event.
begin;

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
    'eventType', n.event_type, 'propertyId', n.property_id::text,
    'endpoint', s.endpoint, 'keys', jsonb_build_object('p256dh',s.p256dh,'auth',s.auth),
    'attempt', d.attempt_count
  )),'[]'::jsonb) into v_result
  from leased d join public.push_subscriptions s on s.id = d.subscription_id
    join public.booking_notifications n on n.id = d.notification_id;
  return v_result;
end;
$$;

revoke all on function public.booking_push_claim(integer) from public, anon, authenticated;
grant execute on function public.booking_push_claim(integer) to service_role;

commit;
