begin;

-- Preserve the installed report implementation (date-range or time-window).
-- Only add the authorization guard; do not replace its query or existing grants.
do $migration$
declare
  v_definition text := pg_get_functiondef('public.dashboard_report(uuid,jsonb)'::regprocedure);
  v_anchor text := 'select role_id = 1, dv_id into v_admin, v_property from public.users where uid = p_actor;';
  v_guard text := $guard$
  -- dashboard_report_permission_required
  if not exists (
    select 1 from public.users u where u.uid = p_actor and (
      u.role_id = 1 or (u.dv_id > 0 and u.allow_tools @> '{"allow_report":true}'::jsonb)
    )
  ) then
    raise exception 'dashboard_forbidden' using errcode = '42501';
  end if;
  $guard$;
begin
  if strpos(v_definition, 'dashboard_report_permission_required') > 0 then return; end if;
  if (length(v_definition) - length(replace(v_definition, v_anchor, ''))) <> length(v_anchor) then
    raise exception 'dashboard_report_permission_definition_mismatch';
  end if;
  execute replace(v_definition, v_anchor, v_guard || v_anchor);
end;
$migration$;

commit;
