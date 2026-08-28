create function public.doc_reorder_sections(
  p_parent_id uuid,
  p_section_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_expected_count integer;
begin
  if not (select doc_private.doc_is_admin()) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  if p_section_ids is null
    or cardinality(p_section_ids) = 0
    or cardinality(p_section_ids) <> cardinality(array(select distinct id from unnest(p_section_ids) as id)) then
    raise exception 'The section order is invalid.' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(810241, 2);

  select count(*)
  into v_expected_count
  from public.doc_sections as section
  where section.parent_id is not distinct from p_parent_id;

  if v_expected_count <> cardinality(p_section_ids)
    or exists (
      select 1
      from public.doc_sections as section
      where section.parent_id is not distinct from p_parent_id
        and section.id <> all(p_section_ids)
    ) then
    raise exception 'The section order must contain every section in the sibling group.' using errcode = '23514';
  end if;

  update public.doc_sections as section
  set sort_order = ordered.ordinality - 1
  from unnest(p_section_ids) with ordinality as ordered(id, ordinality)
  where section.id = ordered.id
    and section.parent_id is not distinct from p_parent_id;
end;
$$;
revoke all on function public.doc_reorder_sections(uuid, uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.doc_reorder_sections(uuid, uuid[]) to authenticated;
