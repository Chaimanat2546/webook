-- Record every Data API GET request before PostgREST processes its query.
-- This captures callers whose query fails during parsing, including references
-- to removed columns such as listings.h_id.
create or replace function private.log_data_api_read_request()
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  request_headers jsonb := coalesce(current_setting('request.headers', true), '{}')::jsonb;
  request_method text := coalesce(current_setting('request.method', true), '');
  request_path text := coalesce(current_setting('request.path', true), '');
  request_ip text;
  request_user_agent text;
  request_client_info text;
  request_referer text;
begin
  if request_method <> 'GET' then
    return;
  end if;

  request_ip := left(
    regexp_replace(
      coalesce(
        nullif(request_headers ->> 'cf-connecting-ip', ''),
        nullif(split_part(request_headers ->> 'x-forwarded-for', ',', 1), ''),
        'unknown'
      ),
      '[\r\n]+',
      ' ',
      'g'
    ),
    128
  );
  request_user_agent := left(
    regexp_replace(coalesce(nullif(request_headers ->> 'user-agent', ''), 'unknown'), '[\r\n]+', ' ', 'g'),
    512
  );
  request_client_info := left(
    regexp_replace(coalesce(nullif(request_headers ->> 'x-client-info', ''), 'unknown'), '[\r\n]+', ' ', 'g'),
    256
  );
  request_referer := left(
    regexp_replace(coalesce(nullif(request_headers ->> 'referer', ''), 'unknown'), '[\r\n]+', ' ', 'g'),
    2_048
  );

  raise log 'DATA_API_READ method=% path=% ip=% ua=% client=% referer=%',
    request_method,
    request_path,
    request_ip,
    request_user_agent,
    request_client_info,
    request_referer;
end;
$$;

revoke all on function private.log_data_api_read_request() from public;
grant execute on function private.log_data_api_read_request() to anon, authenticated, service_role;

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

  if configured_hook is not null
    and configured_hook <> 'private.log_data_api_read_request' then
    raise exception using
      errcode = 'P0001',
      message = 'existing_pgrst_db_pre_request_requires_composition';
  end if;
end;
$$;

alter role authenticator
  set pgrst.db_pre_request = 'private.log_data_api_read_request';

notify pgrst, 'reload config';
