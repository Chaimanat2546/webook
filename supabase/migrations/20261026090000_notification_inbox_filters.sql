-- Category filtering happens before pagination; unreadCount stays global.
create or replace function public.booking_notification_list_filtered(p_actor uuid, p_page integer default 1, p_filter text default 'all')
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
  if p_filter is null or p_filter not in ('all','booking','payment','cancelled') then
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
  ), filtered as (
    select * from scoped where p_filter = 'all'
      or (p_filter = 'booking' and event_type = 'booking_created')
      or (p_filter = 'payment' and event_type in ('payment_succeeded','payment_expired'))
      or (p_filter = 'cancelled' and event_type = 'booking_cancelled')
  ), selected as (
    select * from filtered
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
    'total', (select count(*) from filtered),
    'page', v_page, 'pageSize', 20, 'asOf', v_as_of
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.booking_notification_list_filtered(uuid,integer,text) from public, anon, authenticated;
grant execute on function public.booking_notification_list_filtered(uuid,integer,text) to service_role;
