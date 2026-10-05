-- Count agency bookings only when the booking is confirmed, matching agency sales.
create or replace function public.dashboard_report(p_actor uuid, p_query jsonb)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_admin boolean;
  v_property bigint;
  v_month date;
  v_start timestamptz;
  v_end timestamptz;
  v_from date;
  v_to date;
  v_agency text := nullif(p_query->>'agency', '');
  v_status text := coalesce(p_query->>'status', 'all');
  v_sort text := coalesce(p_query->>'sort', 'updated-desc');
  v_agency_sort text := coalesce(p_query->>'agencySort', 'sales-desc');
  v_search text := coalesce(p_query->>'search', '');
  v_agency_search text := coalesce(p_query->>'agencySearch', '');
  v_page integer := coalesce((p_query->>'page')::integer, 1);
  v_agency_page integer := coalesce((p_query->>'agenciesPage')::integer, 1);
  v_size integer := coalesce((p_query->>'pageSize')::integer, 9);
  v_min numeric := (p_query->>'amountFromCents')::numeric;
  v_max numeric := (p_query->>'amountToCents')::numeric;
  v_result jsonb;
begin
  select role_id = 1, dv_id into v_admin, v_property from public.users where uid = p_actor;
  v_admin := coalesce(v_admin, false);
  if not found or (not v_admin and (v_property is null or v_property <= 0)) then
    raise exception 'dashboard_forbidden' using errcode = '42501';
  end if;
  if not v_admin and (v_agency is not null or p_query->>'view' in ('agency','agencies','house','houses')) then
    raise exception 'dashboard_forbidden' using errcode = '42501';
  end if;
  if p_query is null or jsonb_typeof(p_query) <> 'object'
    or coalesce(p_query->>'month','') !~ '^(19|20|21)[0-9]{2}-(0[1-9]|1[0-2])$'
    or v_status not in ('all','confirmed','waiting','cancelled','repair','unknown')
    or v_sort not in ('updated-desc','checkin-desc','price-asc','price-desc','date-asc','date-desc')
    or v_agency_sort not in ('sales-desc','sales-asc','count-desc','count-asc','name-asc')
    or v_page not between 1 and 999999 or v_agency_page not between 1 and 999999 or v_size not between 1 and 100
    or length(v_search) > 200 or length(v_agency_search) > 200
    or v_min < 0 or v_max < 0 or v_min > v_max
    or v_min <> trunc(v_min) or v_max <> trunc(v_max)
    or v_min > 9007199254740991 or v_max > 9007199254740991
    or (v_agency is not null and v_agency <> 'unassigned' and v_agency !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$')
    or (p_query->>'bookingId' is not null and p_query->>'bookingId' !~ '^[1-9][0-9]{0,18}$') then
    raise exception 'dashboard_invalid_query' using errcode = '22023';
  end if;
  v_month := (p_query->>'month' || '-01')::date;
  v_start := v_month::timestamp at time zone 'Asia/Bangkok';
  v_end := (v_month + interval '1 month')::timestamp at time zone 'Asia/Bangkok';
  v_from := (p_query->>'checkInFrom')::date;
  v_to := (p_query->>'checkInTo')::date;
  if (v_from is null) <> (v_to is null) or v_from > v_to then
    raise exception 'dashboard_invalid_query' using errcode = '22023';
  end if;

  with base as materialized (
    select b.*, coalesce(l.title,'DV-'||b.houseid) as house_title,
      case when v_admin then b.agent_id else null end as safe_agent_id,
      case when v_admin then coalesce(a.name,case when b.agent_id is null then 'ไม่ระบุเอเจนซี่' else 'เอเจนซี่ที่ไม่มีชื่อในระบบ' end) else null end as agent_name,
      case when b.status in ('confirmed','waiting','cancelled','repair') then b.status else 'unknown' end as status_key,
      concat_ws(' ',c.first_name,c.last_name) as customer_name
    from public.bookings b
    join public.listings l on l.id=b.listing_id and l.property_id=b.houseid
    left join public.agents a on a.id=b.agent_id and v_admin
    left join public.customers c on c.id=b.customer_id and c.dv_id=b.houseid
    where (v_admin or b.houseid=v_property)
      and ((v_from is null and b.updated_at >= v_start and b.updated_at < v_end)
        or (v_from is not null and b.check_in >= v_from and b.check_in <= v_to))
  ), scoped as materialized (
    select * from base where v_agency is null or
      (v_agency='unassigned' and agent_id is null) or agent_id::text=v_agency
  ), stats as (
    select count(*) as total, count(*) filter(where status_key='confirmed') as confirmed,
      count(*) filter(where status_key='waiting') as waiting,
      count(*) filter(where status_key='cancelled') as cancelled,
      count(*) filter(where status_key='repair') as repair,
      count(*) filter(where status_key='unknown') as unknown,
      coalesce(sum(round(price_max*100)) filter(where status_key='confirmed'),0) as amount,
      count(*) filter(where status_key='confirmed' and price_max is null) as missing from scoped
  ), groups as materialized (
    select safe_agent_id as id, agent_name as name,
      count(*) filter(where status_key='confirmed') as count,
      coalesce(sum(round(price_max*100)) filter(where status_key='confirmed'),0) as "amountCents",
      count(*) filter(where status_key='confirmed' and price_max is null) as "missingPrices"
    from base where v_admin group by safe_agent_id,agent_name
  ), agency_filtered as materialized (
    select * from groups where strpos(lower(name),lower(v_agency_search))>0
  ), agency_meta as (
    select count(*) as total, greatest(1,ceil(count(*)/10.0)::integer) as pages,
      least(v_agency_page,greatest(1,ceil(count(*)/10.0)::integer)) as page from agency_filtered
  ), agency_page as (
    select * from agency_filtered order by
      case when v_agency_sort='sales-desc' then "amountCents" end desc,
      case when v_agency_sort='sales-asc' then "amountCents" end asc,
      case when v_agency_sort='count-desc' then count end desc,
      case when v_agency_sort='count-asc' then count end asc,
      name collate public.dashboard_thai, id nulls last
    limit 10 offset (select (page-1)*10 from agency_meta)
  ), filtered as materialized (
    select * from scoped where (v_status='all' or status_key=v_status)
      and (v_min is null or round(price_max*100)>=v_min)
      and (v_max is null or round(price_max*100)<=v_max)
      and (v_search='' or strpos(lower(house_title),lower(v_search))>0
        or strpos(lower('DV-'||houseid),lower(v_search))>0
        or strpos(lower(customer_name),lower(v_search))>0
        or (v_admin and strpos(lower(agent_name),lower(v_search))>0))
  ), meta as (
    select count(*) as total, greatest(1,ceil(count(*)/v_size::numeric)::integer) as pages,
      least(v_page,greatest(1,ceil(count(*)/v_size::numeric)::integer)) as page from filtered
  ), page_rows as (
    select * from filtered order by
      case when v_sort in ('checkin-desc','date-desc') then check_in end desc,
      case when v_sort='date-asc' then check_in end asc,
      case when v_sort='price-desc' then price_max end desc nulls last,
      case when v_sort='price-asc' then price_max end asc nulls last,
      updated_at desc,id desc
    limit v_size offset (select (page-1)*v_size from meta)
  ), exposed as (
    select b.*, false as is_detail from page_rows b
    union all select b.*, true from scoped b where b.id::text=p_query->>'bookingId'
  ), payloads as (
    select is_detail, check_in, price_max, updated_at, id, jsonb_build_object(
      'id',id::text,'code',booking_code,'propertyId',houseid::text,'houseTitle',house_title,
      'checkIn',check_in,'checkOut',check_out,'createdAt',created_at,'updatedAt',updated_at,
      'status',status,'priceCents',round(price_max*100),'agentId',safe_agent_id,'agentName',agent_name
    ) || case when is_detail then jsonb_build_object(
      'note',note,'depositCents',round(price_sell*100),'extraChargeCents',round(extra_charge*100),
      'insuranceCents',round(insurance*100),'paymentExpiresAt',payment_expires_at,
      'checkInTime',checkin_time,'checkOutTime',checkout_time,'createdById',created_by
    ) else '{}'::jsonb end as data from exposed
  ), daily_counts as (
    select case when v_from is null then (updated_at at time zone 'Asia/Bangkok')::date else check_in end as day,
      count(*) as count from scoped where status_key='confirmed' group by 1
  ), days as (
    select d::date as date,coalesce(c.count,0) as count
    from generate_series(v_month::timestamp,(v_month+interval '1 month - 1 day')::timestamp,interval '1 day') d
    left join daily_counts c on c.day=d::date
  )
  select jsonb_build_object(
    'bookingCount',s.total,'statusCounts',jsonb_build_object('confirmed',s.confirmed,'waiting',s.waiting,'cancelled',s.cancelled,'repair',s.repair,'unknown',s.unknown),
    'sales',jsonb_build_object('count',s.confirmed,'amountCents',s.amount,'missingPrices',s.missing),
    'totalSalesCents',(select coalesce(sum(round(price_max*100)) filter(where status_key='confirmed'),0) from base),
    'daily',(select coalesce(jsonb_agg(to_jsonb(days) order by date),'[]'::jsonb) from days),
    'bookings',jsonb_build_object('rows',(select coalesce(jsonb_agg(data order by
      case when v_sort in ('checkin-desc','date-desc') then check_in end desc,
      case when v_sort='date-asc' then check_in end asc,
      case when v_sort='price-desc' then price_max end desc nulls last,
      case when v_sort='price-asc' then price_max end asc nulls last,
      updated_at desc,id desc),'[]'::jsonb) from payloads where not is_detail),'total',m.total,'pages',m.pages,'page',m.page),
    'bookingDetail',(select data from payloads where is_detail),
    'agencies',jsonb_build_object('rows',(select coalesce(jsonb_agg(to_jsonb(a) order by
      case when v_agency_sort='sales-desc' then a."amountCents" end desc,
      case when v_agency_sort='sales-asc' then a."amountCents" end asc,
      case when v_agency_sort='count-desc' then a.count end desc,
      case when v_agency_sort='count-asc' then a.count end asc,
      a.name collate public.dashboard_thai, a.id nulls last),'[]'::jsonb) from agency_page a),'total',am.total,'page',am.page,'pages',am.pages),
    'selectedAgency',coalesce(
      (select to_jsonb(g) from groups g where (v_agency='unassigned' and g.id is null) or g.id::text=v_agency),
      case when v_admin and v_agency='unassigned' then jsonb_build_object('id',null,'name','ไม่ระบุเอเจนซี่','count',0,'amountCents',0,'missingPrices',0)
        when v_admin then (select jsonb_build_object('id',a.id,'name',a.name,'count',0,'amountCents',0,'missingPrices',0) from public.agents a where a.id::text=v_agency)
        else null end),
    'agencyCount',(select count(*) from groups),
    'topAgencies',(select coalesce(jsonb_agg(to_jsonb(g) order by g."amountCents" desc,g.count desc,g.name collate public.dashboard_thai,g.id nulls last),'[]'::jsonb) from (select * from groups order by "amountCents" desc,count desc,name collate public.dashboard_thai,id nulls last limit 5) g)
  ) into v_result from stats s cross join meta m cross join agency_meta am;
  return v_result;
exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then
  raise exception 'dashboard_invalid_query' using errcode = '22023';
end;
$$;
revoke all on function public.dashboard_report(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.dashboard_report(uuid,jsonb) to service_role;
