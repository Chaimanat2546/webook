-- Revert the Data API read logging hook introduced by the 20260903 migrations.
do $$
declare
  configured_hook text;
begin
  select split_part(setting, '=', 2)
  into configured_hook
  from pg_db_role_setting role_setting
  cross join lateral unnest(role_setting.setconfig) as setting
  join pg_roles role on role.oid = role_setting.setrole
  where role.rolname = 'authenticator'
    and setting like 'pgrst.db_pre_request=%';

  if configured_hook <> 'private.log_data_api_read_request' then
    raise exception using
      errcode = 'P0001',
      message = 'data_api_read_logging_hook_is_not_the_configured_pre_request';
  end if;
end;
$$;
alter role authenticator reset pgrst.db_pre_request;
notify pgrst, 'reload config';
drop function private.log_data_api_read_request();
