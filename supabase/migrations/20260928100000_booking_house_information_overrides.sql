-- Store booking-specific house information without changing the source listing.
alter table public.bookings
  add column if not exists extra_beds numeric,
  add column if not exists insurance_fee numeric,
  add column if not exists checkin_time time without time zone,
  add column if not exists checkout_time time without time zone;

create or replace function public.admin_update_house_booking(
  p_property_id bigint,
  p_booking_id bigint,
  p_expected_updated_at timestamptz,
  p_actor_id uuid,
  p_values jsonb
) returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_booking public.bookings%rowtype;
  v_start date;
  v_end date;
  v_customer bigint;
  v_status text;
  v_quantity integer;
  v_price numeric;
  v_full_price numeric;
  v_extra numeric;
  v_extra_beds numeric;
  v_insurance_fee numeric;
  v_checkin_time time;
  v_checkout_time time;
  v_previous_sub text;
begin
  if p_actor_id is null then raise exception 'booking_forbidden'; end if;
  select b.* into v_booking from public.bookings b
  join public.listings l on l.id = b.listing_id
  where b.id = p_booking_id and b.houseid = p_property_id and l.property_id = p_property_id
  for update of b;
  if not found then raise exception 'booking_not_found'; end if;
  if p_expected_updated_at is null or v_booking.updated_at is distinct from p_expected_updated_at then raise exception 'booking_stale'; end if;
  if jsonb_typeof(p_values) is distinct from 'object'
    or not (p_values ?& array['check_in','check_out','customer_id','status','quantity','price_sell','price_max','extra_charge','note','extra_beds','insurance_fee','checkin_time','checkout_time'])
    or exists(select 1 from jsonb_object_keys(p_values) k where k not in
      ('check_in','check_out','customer_id','status','quantity','price_sell','price_max','extra_charge','note','extra_beds','insurance_fee','checkin_time','checkout_time'))
    or jsonb_typeof(p_values->'extra_beds') not in ('number','null')
    or jsonb_typeof(p_values->'insurance_fee') not in ('number','null')
    or jsonb_typeof(p_values->'checkin_time') not in ('string','null')
    or jsonb_typeof(p_values->'checkout_time') not in ('string','null')
    or (p_values->>'checkin_time') is not null and (p_values->>'checkin_time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
    or (p_values->>'checkout_time') is not null and (p_values->>'checkout_time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' then
    raise exception 'booking_invalid_input';
  end if;
  v_start := (p_values->>'check_in')::date;
  v_end := (p_values->>'check_out')::date;
  v_customer := (p_values->>'customer_id')::bigint;
  v_status := p_values->>'status';
  v_quantity := v_end - v_start;
  v_price := (p_values->>'price_sell')::numeric;
  v_full_price := (p_values->>'price_max')::numeric;
  v_extra := (p_values->>'extra_charge')::numeric;
  v_extra_beds := (p_values->>'extra_beds')::numeric;
  v_insurance_fee := (p_values->>'insurance_fee')::numeric;
  v_checkin_time := (p_values->>'checkin_time')::time;
  v_checkout_time := (p_values->>'checkout_time')::time;
  if v_status = 'repair' then v_customer := null; v_price := 0; v_full_price := 0; v_extra := 0; end if;
  if v_start is null or v_end is null or not isfinite(v_start) or not isfinite(v_end) or v_end <= v_start
    or v_status is null or v_status not in ('waiting','confirmed','cancelled','repair')
    or v_quantity is null or v_quantity < 1
    or v_price is null or v_price < 0 or v_price > 999999999.99 or v_price <> round(v_price,2)
    or v_full_price < 0 or v_full_price > 999999999.99 or v_full_price <> round(v_full_price,2)
    or v_extra is null or v_extra < 0 or v_extra > 999999999.99 or v_extra <> round(v_extra,2)
    or v_extra_beds is not null and (v_extra_beds < 0 or v_extra_beds > 999999999.99 or v_extra_beds <> round(v_extra_beds,2))
    or v_insurance_fee is not null and (v_insurance_fee < 0 or v_insurance_fee > 999999999.99 or v_insurance_fee <> round(v_insurance_fee,2))
    or length(p_values->>'note') > 10000 then raise exception 'booking_invalid_input'; end if;
  v_previous_sub := current_setting('request.jwt.claim.sub', true);
  perform set_config('request.jwt.claim.sub', p_actor_id::text, true);
  update public.bookings set
    check_in = v_start, check_out = v_end, customer_id = v_customer, status = v_status, quantity = v_quantity,
    price_sell = v_price, price_max = v_full_price, extra_charge = v_extra, note = p_values->>'note',
    extra_beds = v_extra_beds, insurance_fee = v_insurance_fee, checkin_time = v_checkin_time, checkout_time = v_checkout_time,
    updated_at = clock_timestamp()
  where id = v_booking.id;
  perform set_config('request.jwt.claim.sub', coalesce(v_previous_sub,''), true);
end;
$$;

create or replace function public.admin_create_house_booking(
 p_property_id bigint, p_request_id uuid, p_actor_id uuid, p_values jsonb
) returns text language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
 v_listing uuid; v_id bigint; v_booking public.bookings%rowtype;
 v_code text; v_start date; v_end date; v_customer bigint; v_status text;
 v_quantity integer; v_price numeric; v_full_price numeric; v_extra numeric;
 v_extra_beds numeric; v_insurance_fee numeric; v_checkin_time time; v_checkout_time time;
 v_previous_sub text;
begin
 if p_actor_id is null then raise exception 'booking_forbidden'; end if;
 if p_request_id is null then raise exception 'booking_invalid_input'; end if;
 select id into v_listing from public.listings where property_id=p_property_id;
 if not found then raise exception 'booking_house_not_found'; end if;
 if jsonb_typeof(p_values) is distinct from 'object'
   or not (p_values ?& array['check_in','check_out','customer_id','status','quantity','price_sell','price_max','extra_charge','note','extra_beds','insurance_fee','checkin_time','checkout_time'])
   or exists(select 1 from jsonb_object_keys(p_values) k where k not in
     ('check_in','check_out','customer_id','status','quantity','price_sell','price_max','extra_charge','note','extra_beds','insurance_fee','checkin_time','checkout_time'))
   or jsonb_typeof(p_values->'extra_beds') not in ('number','null')
   or jsonb_typeof(p_values->'insurance_fee') not in ('number','null')
   or jsonb_typeof(p_values->'checkin_time') not in ('string','null')
   or jsonb_typeof(p_values->'checkout_time') not in ('string','null')
   or (p_values->>'checkin_time') is not null and (p_values->>'checkin_time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
   or (p_values->>'checkout_time') is not null and (p_values->>'checkout_time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' then raise exception 'booking_invalid_input'; end if;
 v_start := (p_values->>'check_in')::date;
 v_end := (p_values->>'check_out')::date;
 v_customer := (p_values->>'customer_id')::bigint;
 v_status := p_values->>'status';
 v_quantity := v_end - v_start;
 v_price := (p_values->>'price_sell')::numeric;
 v_full_price := (p_values->>'price_max')::numeric;
 v_extra := (p_values->>'extra_charge')::numeric;
 v_extra_beds := (p_values->>'extra_beds')::numeric;
 v_insurance_fee := (p_values->>'insurance_fee')::numeric;
 v_checkin_time := (p_values->>'checkin_time')::time;
 v_checkout_time := (p_values->>'checkout_time')::time;
 if v_status = 'repair' then v_customer := null; v_price := 0; v_full_price := 0; v_extra := 0; end if;
 if v_start is null or v_end is null or not isfinite(v_start) or not isfinite(v_end) or v_end <= v_start
   or v_status is null or v_status not in ('waiting','confirmed','repair') or v_quantity is null or v_quantity < 1
   or v_price is null or v_price < 0 or v_price > 999999999.99 or v_price <> round(v_price,2)
   or (v_customer is null and v_status <> 'repair') or v_full_price is null or v_full_price < 0 or v_full_price > 999999999.99 or v_full_price <> round(v_full_price,2)
   or v_extra is null or v_extra < 0 or v_extra > 999999999.99 or v_extra <> round(v_extra,2)
   or v_extra_beds is not null and (v_extra_beds < 0 or v_extra_beds > 999999999.99 or v_extra_beds <> round(v_extra_beds,2))
   or v_insurance_fee is not null and (v_insurance_fee < 0 or v_insurance_fee > 999999999.99 or v_insurance_fee <> round(v_insurance_fee,2))
   or length(p_values->>'note') > 10000 then raise exception 'booking_invalid_input'; end if;
 v_code := 'BK-' || p_request_id::text;
 perform pg_advisory_xact_lock(hashtextextended(v_code,0));
 select * into v_booking from public.bookings where booking_code=v_code;
 if found then
   if v_booking.listing_id<>v_listing or v_booking.houseid is distinct from p_property_id or v_booking.created_by is distinct from p_actor_id then raise exception 'booking_forbidden'; end if;
   return v_booking.id::text;
 end if;
 v_previous_sub := current_setting('request.jwt.claim.sub',true);
 perform set_config('request.jwt.claim.sub',p_actor_id::text,true);
 insert into public.bookings(booking_code,listing_id,houseid,customer_id,check_in,check_out,status,quantity,price_sell,price_max,extra_charge,note,extra_beds,insurance_fee,checkin_time,checkout_time,created_by)
 values(v_code,v_listing,p_property_id,v_customer,v_start,v_end,v_status,v_quantity,v_price,v_full_price,v_extra,p_values->>'note',v_extra_beds,v_insurance_fee,v_checkin_time,v_checkout_time,p_actor_id)
 returning id into v_id;
 perform set_config('request.jwt.claim.sub',coalesce(v_previous_sub,''),true);
 return v_id::text;
end;
$$;

revoke all on function public.admin_update_house_booking(bigint,bigint,timestamptz,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.admin_update_house_booking(bigint,bigint,timestamptz,uuid,jsonb) to service_role;
revoke all on function public.admin_create_house_booking(bigint,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.admin_create_house_booking(bigint,uuid,uuid,jsonb) to service_role;
notify pgrst, 'reload schema';
