-- Create a booking for an existing customer. Permissions are checked by the web.
-- No RLS changes. Unique request IDs make retries return the same booking.
create or replace function public.admin_create_house_booking(
 p_property_id bigint, p_request_id uuid, p_actor_id uuid, p_values jsonb
) returns text language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
 v_listing uuid; v_id bigint; v_booking public.bookings%rowtype;
 v_code text; v_start date; v_end date; v_customer bigint; v_status text;
 v_quantity integer; v_price numeric; v_full_price numeric; v_extra numeric;
 v_previous_sub text;
begin
 if p_actor_id is null then raise exception 'booking_forbidden'; end if;
 if p_request_id is null then raise exception 'booking_invalid_input'; end if;
 select id into v_listing from public.listings where property_id=p_property_id;
 if not found then raise exception 'booking_house_not_found'; end if;
  if jsonb_typeof(p_values) is distinct from 'object'
    or not (p_values ?& array['check_in','check_out','customer_id','status','quantity','price_sell','price_max','extra_charge','note'])
    or exists(select 1 from jsonb_object_keys(p_values) k where k not in
      ('check_in','check_out','customer_id','status','quantity','price_sell','price_max','extra_charge','note')) then
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
  if v_start is null or v_end is null or not isfinite(v_start) or not isfinite(v_end) or v_end <= v_start
    or v_status is null or v_status not in ('waiting','confirmed')
    or v_quantity is null or v_quantity < 1
    or v_price is null or v_price < 0 or v_price > 999999999.99 or v_price <> round(v_price,2)
    or v_customer is null or v_full_price is null or v_full_price < 0 or v_full_price > 999999999.99 or v_full_price <> round(v_full_price,2)
    or v_extra is null or v_extra < 0 or v_extra > 999999999.99 or v_extra <> round(v_extra,2)
    or length(p_values->>'note') > 10000 then
    raise exception 'booking_invalid_input';
  end if;

 v_code := 'BK-' || p_request_id::text;
 perform pg_advisory_xact_lock(hashtextextended(v_code,0));
 select * into v_booking from public.bookings where booking_code=v_code;
 if found then
   if v_booking.listing_id<>v_listing or v_booking.houseid is distinct from p_property_id or v_booking.created_by is distinct from p_actor_id then
     raise exception 'booking_forbidden';
   end if;
   return v_booking.id::text;
 end if;
 v_previous_sub := current_setting('request.jwt.claim.sub',true);
 perform set_config('request.jwt.claim.sub',p_actor_id::text,true);
 insert into public.bookings(booking_code,listing_id,houseid,customer_id,check_in,check_out,status,quantity,price_sell,price_max,extra_charge,note,created_by)
 values(v_code,v_listing,p_property_id,v_customer,v_start,v_end,v_status,v_quantity,v_price,v_full_price,v_extra,p_values->>'note',p_actor_id)
 returning id into v_id;
 perform set_config('request.jwt.claim.sub',coalesce(v_previous_sub,''),true);
 return v_id::text;
end;
$$;
revoke all on function public.admin_create_house_booking(bigint,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.admin_create_house_booking(bigint,uuid,uuid,jsonb) to service_role;
notify pgrst, 'reload schema';
