begin;

-- Collection remains available to session owners through the service-only RPCs.
-- Viewing history, including one's own rows, is now restricted to root admins.
drop policy login_history_read on public.login_history;
create policy login_history_read on public.login_history for select to authenticated
using ((select login_history_private.is_root(auth.uid())));

-- Remove the old self-readable signature; six-argument callers use the defaults
-- on this root-only function, so an old overload cannot bypass authorization.
drop function public.login_history_list(uuid,text,timestamptz,timestamptz,integer,integer);
create function public.login_history_list(
  p_actor uuid,p_search text,p_from timestamptz,p_to timestamptz,p_page integer,p_size integer,
  p_status text default null,p_sort text default 'latest'
)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $$
declare result jsonb;
begin
  if p_actor is null then raise exception 'unauthenticated' using errcode='28000'; end if;
  if not login_history_private.is_root(p_actor) then raise exception 'history_forbidden' using errcode='42501'; end if;
  if p_page is null or p_page not between 1 and 1000000 or p_size is null or p_size not between 1 and 100
    or (p_from is not null and p_to is not null and p_from >= p_to)
    or length(coalesce(p_search,'')) > 200
    or (p_status is not null and p_status not in ('pending','success','skipped','denied','unavailable','timeout','unsupported'))
    or p_sort is null or p_sort not in ('latest','oldest') then
    raise exception 'invalid_filter' using errcode='22023';
  end if;
  with filtered as materialized (
    select h.*, profile.name as display_name, profile.username, profile.email
    from public.login_history h
    left join lateral (
      select min(u.name) as name,min(u.username) as username,min(u.email) as email
      from public.users u where u.uid=h.user_id having count(*)=1
    ) profile on true
    where (p_from is null or h.logged_in_at >= p_from) and (p_to is null or h.logged_in_at < p_to)
      and (p_status is null or h.location_status=p_status)
      and (coalesce(p_search,'')='' or position(lower(p_search) in lower(concat_ws(' ',profile.name,profile.username,profile.email))) > 0)
  ), page as (
    select * from filtered order by
      case when p_sort='latest' then logged_in_at end desc,
      case when p_sort='oldest' then logged_in_at end asc,
      case when p_sort='latest' then id end desc,
      case when p_sort='oldest' then id end asc
    limit p_size offset ((p_page-1)*p_size)
  )
  select jsonb_build_object('total',(select count(*) from filtered),
    'entries',coalesce((select jsonb_agg(to_jsonb(page)-'session_id' order by
      case when p_sort='latest' then logged_in_at end desc,
      case when p_sort='oldest' then logged_in_at end asc,
      case when p_sort='latest' then id end desc,
      case when p_sort='oldest' then id end asc) from page),'[]'::jsonb)) into result;
  return result;
end;
$$;
revoke all on function public.login_history_list(uuid,text,timestamptz,timestamptz,integer,integer,text,text) from public,anon,authenticated;
grant execute on function public.login_history_list(uuid,text,timestamptz,timestamptz,integer,integer,text,text) to service_role;
commit;
