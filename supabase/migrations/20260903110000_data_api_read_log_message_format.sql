-- Keep Data API read logs easy to scan in Supabase Logs Explorer.
-- The raw request URL (and therefore the exact h_id expression) remains in
-- edge_logs; PostgREST exposes only request headers and path to this hook.
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
  request_host text;
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
  request_host := left(
    regexp_replace(coalesce(nullif(request_headers ->> 'host', ''), 'unknown'), '[\r\n]+', ' ', 'g'),
    256
  );
  request_client_info := left(
    regexp_replace(coalesce(nullif(request_headers ->> 'x-client-info', ''), 'unknown'), '[\r\n]+', ' ', 'g'),
    256
  );
  request_referer := left(
    regexp_replace(coalesce(nullif(request_headers ->> 'referer', ''), 'unknown'), '[\r\n]+', ' ', 'g'),
    2_048
  );

  raise log 'UA: % | IP: % | Host: % | X-Client: % | Path: % | Referer: %',
    request_user_agent,
    request_ip,
    request_host,
    request_client_info,
    request_path,
    request_referer;
end;
$$;
