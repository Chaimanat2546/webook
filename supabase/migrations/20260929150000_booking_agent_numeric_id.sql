begin;

-- Production has UUID Agents while bookings already store bigint agent_id.
-- Preserve each Agent/account relationship through a temporary mapping, and
-- deliberately null unresolvable historic booking numbers before adding the FK.
drop policy if exists "anon: read agent_accounts of active agents" on public.agent_accounts;
alter table public.agent_accounts drop constraint if exists agent_accounts_agent_id_fkey;
alter table public.agent_accounts drop constraint if exists agent_accounts_agent_id_bank_id_account_number_key;
drop index if exists public.idx_agent_accounts_agent_id;

create sequence if not exists public.agents_id_seq as bigint;
select setval(
  'public.agents_id_seq',
  greatest(coalesce((select max(agent_id) from public.bookings), 0) + 1, 1),
  false
);

alter table public.agents rename column id to legacy_uuid;
alter table public.agents add column id bigint;
update public.agents set id = nextval('public.agents_id_seq');
alter table public.agents alter column id set not null;

create temporary table booking_agent_id_map (
  legacy_uuid uuid primary key,
  id bigint not null unique
) on commit drop;
insert into booking_agent_id_map (legacy_uuid, id)
select legacy_uuid, id from public.agents;

alter table public.agent_accounts add column agent_id_bigint bigint;
update public.agent_accounts account
set agent_id_bigint = map.id
from booking_agent_id_map map
where account.agent_id = map.legacy_uuid;
alter table public.agent_accounts alter column agent_id_bigint set not null;
alter table public.agent_accounts drop column agent_id;
alter table public.agent_accounts rename column agent_id_bigint to agent_id;

alter table public.agents drop constraint agents_pkey;
alter table public.agents drop column legacy_uuid;
alter table public.agents add constraint agents_pkey primary key (id);
alter table public.agents alter column id set default nextval('public.agents_id_seq');
alter sequence public.agents_id_seq owned by public.agents.id;

alter table public.agent_accounts
  add constraint agent_accounts_agent_id_fkey
  foreign key (agent_id) references public.agents(id) on delete cascade;
alter table public.agent_accounts
  add constraint agent_accounts_agent_id_bank_id_account_number_key
  unique (agent_id, bank_id, account_number);
create index idx_agent_accounts_agent_id on public.agent_accounts(agent_id);

-- Existing numeric values cannot be matched to former UUID identities. They
-- are cleared rather than pointed at an arbitrary newly generated Agent.
update public.bookings set agent_id = null where agent_id is not null;
alter table public.bookings
  add constraint bookings_agent_id_fkey
  foreign key (agent_id) references public.agents(id) on delete set null;

create policy "anon: read agent_accounts of active agents"
  on public.agent_accounts for select to anon
  using (exists (
    select 1 from public.agents
    where agents.id = agent_accounts.agent_id and agents.is_active = true
  ));

create or replace function public.admin_create_house_booking(
  p_property_id bigint,
  p_request_id uuid,
  p_actor_id uuid,
  p_values jsonb
) returns text
language plpgsql
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_listing uuid; v_id bigint; v_booking public.bookings%rowtype;
  v_code text; v_start date; v_end date; v_customer bigint; v_status text;
  v_quantity integer; v_price numeric; v_full_price numeric; v_extra numeric;
  v_insurance numeric; v_extra_person numeric; v_checkin_time time without time zone;
  v_checkout_time time without time zone; v_agent bigint; v_previous_sub text;
begin
  if p_actor_id is null then raise exception 'booking_forbidden'; end if;
  if p_request_id is null then raise exception 'booking_invalid_input'; end if;
  select id into v_listing from public.listings where property_id = p_property_id;
  if not found then raise exception 'booking_house_not_found'; end if;
  if jsonb_typeof(p_values) is distinct from 'object'
    or not (p_values ?& array['check_in','check_out','customer_id','status','quantity','price_sell','price_max','extra_charge','note','insurance','extra_person','checkin_time','checkout_time'])
    or exists (select 1 from jsonb_object_keys(p_values) key where key not in ('check_in','check_out','customer_id','status','quantity','price_sell','price_max','extra_charge','note','insurance','extra_person','checkin_time','checkout_time','agent_id')) then
    raise exception 'booking_invalid_input';
  end if;
  if ((p_values ->> 'checkin_time') is not null and (p_values ->> 'checkin_time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$')
    or ((p_values ->> 'checkout_time') is not null and (p_values ->> 'checkout_time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$') then
    raise exception 'booking_invalid_input';
  end if;
  begin
    v_start := (p_values ->> 'check_in')::date; v_end := (p_values ->> 'check_out')::date;
    v_customer := (p_values ->> 'customer_id')::bigint; v_status := p_values ->> 'status';
    v_quantity := v_end - v_start; v_price := (p_values ->> 'price_sell')::numeric;
    v_full_price := (p_values ->> 'price_max')::numeric; v_extra := (p_values ->> 'extra_charge')::numeric;
    v_insurance := (p_values ->> 'insurance')::numeric; v_extra_person := (p_values ->> 'extra_person')::numeric;
    v_checkin_time := (p_values ->> 'checkin_time')::time without time zone;
    v_checkout_time := (p_values ->> 'checkout_time')::time without time zone;
    v_agent := case when p_values ? 'agent_id' then nullif(p_values ->> 'agent_id', '')::bigint else null end;
  exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then
    raise exception 'booking_invalid_input';
  end;
  if v_status = 'repair' then v_customer := null; v_price := 0; v_full_price := 0; v_extra := 0; end if;
  if v_start is null or v_end is null or not isfinite(v_start) or not isfinite(v_end) or v_end <= v_start
    or v_status is null or v_status not in ('waiting','confirmed','repair') or v_quantity < 1
    or v_price is null or v_price < 0 or v_price > 999999999.99 or v_price <> round(v_price,2)
    or (v_customer is null and v_status <> 'repair') or v_full_price is null or v_full_price < 0 or v_full_price > 999999999.99 or v_full_price <> round(v_full_price,2)
    or v_extra is null or v_extra < 0 or v_extra > 999999999.99 or v_extra <> round(v_extra,2)
    or (v_insurance is not null and (v_insurance < 0 or v_insurance > 999999999.99 or v_insurance <> round(v_insurance,2)))
    or (v_extra_person is not null and (v_extra_person < 0 or v_extra_person > 999999999.99 or v_extra_person <> round(v_extra_person,2)))
    or length(p_values ->> 'note') > 10000 then raise exception 'booking_invalid_input'; end if;
  if v_agent is not null and not exists (select 1 from public.users where uid = p_actor_id and role_id = 1) then raise exception 'booking_agent_forbidden'; end if;
  if v_agent is not null and not exists (select 1 from public.agents where id = v_agent and is_active = true) then raise exception 'booking_agent_invalid'; end if;
  v_code := 'BK-' || p_request_id::text; perform pg_advisory_xact_lock(hashtextextended(v_code, 0));
  select * into v_booking from public.bookings where booking_code = v_code;
  if found then
    if v_booking.listing_id <> v_listing or v_booking.houseid is distinct from p_property_id or v_booking.created_by is distinct from p_actor_id then raise exception 'booking_forbidden'; end if;
    return v_booking.id::text;
  end if;
  v_previous_sub := current_setting('request.jwt.claim.sub', true); perform set_config('request.jwt.claim.sub', p_actor_id::text, true);
  insert into public.bookings (booking_code,listing_id,houseid,customer_id,check_in,check_out,status,quantity,price_sell,price_max,extra_charge,note,insurance,extra_person,checkin_time,checkout_time,agent_id,created_by)
  values (v_code,v_listing,p_property_id,v_customer,v_start,v_end,v_status,v_quantity,v_price,v_full_price,v_extra,p_values ->> 'note',v_insurance,v_extra_person,v_checkin_time,v_checkout_time,v_agent,p_actor_id)
  returning id into v_id;
  perform set_config('request.jwt.claim.sub', coalesce(v_previous_sub,''), true); return v_id::text;
end;
$$;

create or replace function public.admin_update_house_booking(
  p_property_id bigint,
  p_booking_id bigint,
  p_expected_updated_at timestamptz,
  p_actor_id uuid,
  p_values jsonb
) returns void
language plpgsql
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_booking public.bookings%rowtype; v_start date; v_end date; v_customer bigint;
  v_status text; v_quantity integer; v_price numeric; v_full_price numeric; v_extra numeric;
  v_insurance numeric; v_extra_person numeric; v_checkin_time time without time zone;
  v_checkout_time time without time zone; v_agent bigint; v_previous_sub text;
begin
  if p_actor_id is null then raise exception 'booking_forbidden'; end if;
  select b.* into v_booking from public.bookings b join public.listings l on l.id = b.listing_id where b.id = p_booking_id and b.houseid = p_property_id and l.property_id = p_property_id for update of b;
  if not found then raise exception 'booking_not_found'; end if;
  if p_expected_updated_at is null or v_booking.updated_at is distinct from p_expected_updated_at then raise exception 'booking_stale'; end if;
  if jsonb_typeof(p_values) is distinct from 'object'
    or not (p_values ?& array['check_in','check_out','customer_id','status','quantity','price_sell','price_max','extra_charge','note','insurance','extra_person','checkin_time','checkout_time'])
    or exists (select 1 from jsonb_object_keys(p_values) key where key not in ('check_in','check_out','customer_id','status','quantity','price_sell','price_max','extra_charge','note','insurance','extra_person','checkin_time','checkout_time','agent_id')) then raise exception 'booking_invalid_input'; end if;
  if ((p_values ->> 'checkin_time') is not null and (p_values ->> 'checkin_time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$')
    or ((p_values ->> 'checkout_time') is not null and (p_values ->> 'checkout_time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$') then raise exception 'booking_invalid_input'; end if;
  begin
    v_start := (p_values ->> 'check_in')::date; v_end := (p_values ->> 'check_out')::date; v_customer := (p_values ->> 'customer_id')::bigint; v_status := p_values ->> 'status'; v_quantity := v_end-v_start; v_price := (p_values ->> 'price_sell')::numeric; v_full_price := (p_values ->> 'price_max')::numeric; v_extra := (p_values ->> 'extra_charge')::numeric; v_insurance := (p_values ->> 'insurance')::numeric; v_extra_person := (p_values ->> 'extra_person')::numeric; v_checkin_time := (p_values ->> 'checkin_time')::time without time zone; v_checkout_time := (p_values ->> 'checkout_time')::time without time zone;
    v_agent := case when p_values ? 'agent_id' then nullif(p_values ->> 'agent_id', '')::bigint else v_booking.agent_id end;
  exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then raise exception 'booking_invalid_input'; end;
  if v_status = 'repair' then v_customer := null; v_price := 0; v_full_price := 0; v_extra := 0; end if;
  if v_start is null or v_end is null or not isfinite(v_start) or not isfinite(v_end) or v_end <= v_start or v_status is null or v_status not in ('waiting','confirmed','cancelled','repair') or v_quantity < 1 or v_price is null or v_price < 0 or v_price > 999999999.99 or v_price <> round(v_price,2) or v_full_price is null or v_full_price < 0 or v_full_price > 999999999.99 or v_full_price <> round(v_full_price,2) or v_extra is null or v_extra < 0 or v_extra > 999999999.99 or v_extra <> round(v_extra,2) or (v_insurance is not null and (v_insurance < 0 or v_insurance > 999999999.99 or v_insurance <> round(v_insurance,2))) or (v_extra_person is not null and (v_extra_person < 0 or v_extra_person > 999999999.99 or v_extra_person <> round(v_extra_person,2))) or length(p_values ->> 'note') > 10000 then raise exception 'booking_invalid_input'; end if;
  if (p_values ? 'agent_id') and v_agent is distinct from v_booking.agent_id and not exists (select 1 from public.users where uid = p_actor_id and role_id = 1) then raise exception 'booking_agent_forbidden'; end if;
  if (p_values ? 'agent_id') and v_agent is not null and not exists (select 1 from public.agents where id = v_agent and is_active = true) then raise exception 'booking_agent_invalid'; end if;
  v_previous_sub := current_setting('request.jwt.claim.sub', true); perform set_config('request.jwt.claim.sub', p_actor_id::text, true);
  update public.bookings set check_in=v_start, check_out=v_end, customer_id=v_customer, status=v_status, quantity=v_quantity, price_sell=v_price, price_max=v_full_price, extra_charge=v_extra, note=p_values ->> 'note', insurance=v_insurance, extra_person=v_extra_person, checkin_time=v_checkin_time, checkout_time=v_checkout_time, agent_id=v_agent, updated_at=clock_timestamp() where id=v_booking.id;
  perform set_config('request.jwt.claim.sub', coalesce(v_previous_sub,''), true);
end;
$$;

revoke all on function public.admin_create_house_booking(bigint, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.admin_create_house_booking(bigint, uuid, uuid, jsonb) to service_role;
revoke all on function public.admin_update_house_booking(bigint, bigint, timestamptz, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.admin_update_house_booking(bigint, bigint, timestamptz, uuid, jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
