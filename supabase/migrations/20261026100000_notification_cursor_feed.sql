-- Keyset feed; polling revalidates only the loaded cursor window and never marks read.
create or replace function public.booking_notification_feed(p_actor uuid, p_filter text default 'all', p_cursor jsonb default null, p_head jsonb default null, p_tail jsonb default null, p_window_cursor jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare
  v_position jsonb;
  v_as_of timestamptz := clock_timestamp();
  v_result jsonb;
begin
  if not public.booking_notification_actor_allowed(p_actor) then
    raise exception 'notification_forbidden' using errcode = '42501';
  end if;
  if p_filter is null or p_filter not in ('all','booking','payment','cancelled') then
    raise exception 'notification_invalid_input' using errcode = '22023';
  end if;
  if (p_head is null) <> (p_tail is null) or (p_cursor is not null and p_head is not null) or (p_window_cursor is not null and p_head is null) then
    raise exception 'notification_invalid_input' using errcode = '22023';
  end if;
  foreach v_position in array array[p_cursor,p_head,p_tail,p_window_cursor] loop
    if v_position is not null then
      if jsonb_typeof(v_position) <> 'object' or v_position->>'id' is null or v_position->>'createdAt' is null then
        raise exception 'notification_invalid_input' using errcode = '22023';
      end if;
      perform (v_position->>'id')::uuid, (v_position->>'createdAt')::timestamptz;
    end if;
  end loop;
  if p_head is not null and ((p_head->>'createdAt')::timestamptz,(p_head->>'id')::uuid) < ((p_tail->>'createdAt')::timestamptz,(p_tail->>'id')::uuid) then
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
  ), batch as materialized (
    select * from filtered
    where p_cursor is null or (created_at,id) < ((p_cursor->>'createdAt')::timestamptz,(p_cursor->>'id')::uuid)
    order by created_at desc, id desc limit 21
  ), selected as (
    select * from batch order by created_at desc, id desc limit 20
  ), retained_window as materialized (
    select * from filtered where p_head is not null
      and (created_at,id) <= ((p_head->>'createdAt')::timestamptz,(p_head->>'id')::uuid)
      and (created_at,id) >= ((p_tail->>'createdAt')::timestamptz,(p_tail->>'id')::uuid)
      and (p_window_cursor is null or (created_at,id) < ((p_window_cursor->>'createdAt')::timestamptz,(p_window_cursor->>'id')::uuid))
    order by created_at desc,id desc limit 101
  ), retained_selected as (
    select * from retained_window order by created_at desc,id desc limit 100
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
    'page', 1, 'pageSize', 20, 'asOf', v_as_of,
    'nextCursor', case when (select count(*) from batch) > 20 then
      (select jsonb_build_object('createdAt',created_at,'id',id::text) from selected order by created_at,id limit 1) else null end,
    'hasNew', p_head is not null and exists(select 1 from filtered where (created_at,id) > ((p_head->>'createdAt')::timestamptz,(p_head->>'id')::uuid)),
    'retainedCursor', case when (select count(*) from retained_window) > 100 then
      (select jsonb_build_object('createdAt',created_at,'id',id::text) from retained_selected order by created_at,id limit 1) else null end,
    'retained', case when p_head is null then null else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',id::text,'bookingId',booking_id::text,'propertyId',property_id::text,
        'title',coalesce(title,''),'checkIn',coalesce(check_in::text,''),'checkOut',coalesce(check_out::text,''),
        'status',coalesce(status,''),'eventType',event_type,
        'source',case when calendar_source_id is not null then 'ical' else 'internal' end,
        'createdAt',created_at,'bookingUpdatedAt',booking_updated_at,'readAt',read_at
      )) from retained_selected
    ),'[]'::jsonb) end
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.booking_notification_feed(uuid,text,jsonb,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.booking_notification_feed(uuid,text,jsonb,jsonb,jsonb,jsonb) to service_role;
