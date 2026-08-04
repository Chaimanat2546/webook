alter table public.customer_projects
  add column expected_agent_version text,
  add column expected_schema_version text,
  add column auth_attestation_version text,
  add column auth_attestation_digest text,
  add column auth_attestation_checked_at timestamp with time zone,
  add column last_health_status text not null default 'unknown',
  add column last_health_safe_error text,
  add column last_health_protocol_version integer,
  add column last_health_tenant_id uuid,
  add column last_health_project_ref text,
  add column last_health_agent_version text,
  add column last_health_schema_version text,
  add column last_health_auth_attestation_version text,
  add column last_health_auth_attestation_digest text,
  add column last_health_auth_attestation_checked_at timestamp with time zone;

alter table public.customer_projects
  add constraint customer_projects_expected_agent_version check (
    expected_agent_version is null
    or expected_agent_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'
  ),
  add constraint customer_projects_expected_schema_version check (
    expected_schema_version is null
    or expected_schema_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'
  ),
  add constraint customer_projects_auth_attestation check (
    (
      auth_attestation_version is null
      and auth_attestation_digest is null
      and auth_attestation_checked_at is null
    )
    or
    (
      auth_attestation_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'
      and auth_attestation_digest ~ '^[0-9a-f]{64}$'
      and auth_attestation_checked_at is not null
    )
  ),
  add constraint customer_projects_last_health_status check (
    last_health_status in ('unknown', 'healthy', 'unhealthy')
  ),
  add constraint customer_projects_last_health_safe_error check (
    last_health_safe_error is null
    or last_health_safe_error ~ '^[a-z0-9_]{1,64}$'
  ),
  add constraint customer_projects_last_health_bundle check (
    (
      last_health_status = 'healthy'
      and last_health_protocol_version = 1
      and last_health_tenant_id is not null
      and last_health_project_ref is not null
      and last_health_agent_version is not null
      and last_health_schema_version is not null
      and last_health_auth_attestation_version is not null
      and last_health_auth_attestation_digest ~ '^[0-9a-f]{64}$'
      and last_health_auth_attestation_checked_at is not null
    )
    or
    (
      last_health_status in ('unknown', 'unhealthy')
      and last_health_protocol_version is null
      and last_health_tenant_id is null
      and last_health_project_ref is null
      and last_health_agent_version is null
      and last_health_schema_version is null
      and last_health_auth_attestation_version is null
      and last_health_auth_attestation_digest is null
      and last_health_auth_attestation_checked_at is null
    )
  );

create unique index customer_projects_agent_origin_key
  on public.customer_projects (agent_origin);

alter table public.customer_projects
  drop constraint customer_projects_activation_proof;

alter table public.customer_projects
  add constraint customer_projects_activation_proof check (
    not is_active or (
      expected_agent_version is not null
      and expected_schema_version is not null
      and auth_attestation_version is not null
      and auth_attestation_digest is not null
      and auth_attestation_checked_at is not null
      and bearer_token_version = last_verified_token_version
      and last_health_status = 'healthy'
      and last_health_protocol_version = 1
      and last_health_tenant_id = id
      and last_health_project_ref = target_supabase_project_ref
      and last_health_agent_version = expected_agent_version
      and last_health_schema_version = expected_schema_version
      and last_health_auth_attestation_version = auth_attestation_version
      and last_health_auth_attestation_digest = auth_attestation_digest
      and last_health_auth_attestation_checked_at = auth_attestation_checked_at
      and last_health_checked_at >= bearer_token_updated_at
      and last_list_users_checked_at >= bearer_token_updated_at
    )
  );

create or replace view public.central_user_manager_projects
with (security_invoker = true)
as
select
  id,
  display_name,
  is_active,
  last_verified_token_version,
  last_health_checked_at,
  last_list_users_checked_at,
  created_at,
  updated_at,
  expected_agent_version,
  expected_schema_version,
  auth_attestation_version,
  auth_attestation_checked_at,
  last_health_status,
  last_health_safe_error,
  last_health_agent_version,
  last_health_schema_version,
  last_health_auth_attestation_version,
  last_health_auth_attestation_checked_at
from public.customer_projects;

revoke all privileges on table public.central_user_manager_projects
  from public, anon, authenticated, service_role;
grant select on public.central_user_manager_projects to service_role;

revoke all on function public.register_customer_project(uuid, text, text, text, text)
  from public, anon, authenticated, service_role;
drop function public.register_customer_project(uuid, text, text, text, text);
revoke all on function private.register_customer_project(uuid, text, text, text, text)
  from public, anon, authenticated, service_role;
drop function private.register_customer_project(uuid, text, text, text, text);

create function private.register_customer_project(
  p_tenant_id uuid,
  p_display_name text,
  p_target_supabase_project_ref text,
  p_agent_origin text,
  p_wrangler_environment text,
  p_expected_agent_version text,
  p_expected_schema_version text,
  p_auth_attestation_version text,
  p_auth_attestation_digest text,
  p_auth_attestation_checked_at timestamp with time zone
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_existing public.customer_projects%rowtype;
begin
  perform private.require_central_user_service_role();

  if p_expected_agent_version is null
    or p_expected_schema_version is null
    or p_auth_attestation_version is null
    or p_auth_attestation_digest is null
    or p_auth_attestation_checked_at is null
  then
    raise exception using
      errcode = '22023',
      message = 'central_user_manager_invalid_health_contract';
  end if;

  insert into public.customer_projects (
    id,
    display_name,
    target_supabase_project_ref,
    agent_origin,
    wrangler_environment,
    expected_agent_version,
    expected_schema_version,
    auth_attestation_version,
    auth_attestation_digest,
    auth_attestation_checked_at,
    is_active
  )
  values (
    p_tenant_id,
    p_display_name,
    p_target_supabase_project_ref,
    p_agent_origin,
    p_wrangler_environment,
    p_expected_agent_version,
    p_expected_schema_version,
    p_auth_attestation_version,
    p_auth_attestation_digest,
    p_auth_attestation_checked_at,
    false
  )
  on conflict do nothing;

  if found then
    return jsonb_build_object('outcome', 'registered', 'isActive', false);
  end if;

  select *
  into v_existing
  from public.customer_projects
  where id = p_tenant_id;

  if found
    and v_existing.display_name is not distinct from p_display_name
    and v_existing.target_supabase_project_ref is not distinct from p_target_supabase_project_ref
    and v_existing.agent_origin is not distinct from p_agent_origin
    and v_existing.wrangler_environment is not distinct from p_wrangler_environment
    and v_existing.expected_agent_version is not distinct from p_expected_agent_version
    and v_existing.expected_schema_version is not distinct from p_expected_schema_version
    and v_existing.auth_attestation_version is not distinct from p_auth_attestation_version
    and v_existing.auth_attestation_digest is not distinct from p_auth_attestation_digest
    and v_existing.auth_attestation_checked_at is not distinct from p_auth_attestation_checked_at
    and v_existing.is_active = false
  then
    return jsonb_build_object('outcome', 'retry', 'isActive', false);
  end if;

  raise exception using
    errcode = '23505',
    message = 'central_user_manager_project_registration_conflict';
end;
$$;

create function public.register_customer_project(
  p_tenant_id uuid,
  p_display_name text,
  p_target_supabase_project_ref text,
  p_agent_origin text,
  p_wrangler_environment text,
  p_expected_agent_version text,
  p_expected_schema_version text,
  p_auth_attestation_version text,
  p_auth_attestation_digest text,
  p_auth_attestation_checked_at timestamp with time zone
)
returns jsonb
language sql
set search_path = pg_catalog, public, private
as $$
  select private.register_customer_project(
    p_tenant_id,
    p_display_name,
    p_target_supabase_project_ref,
    p_agent_origin,
    p_wrangler_environment,
    p_expected_agent_version,
    p_expected_schema_version,
    p_auth_attestation_version,
    p_auth_attestation_digest,
    p_auth_attestation_checked_at
  );
$$;

revoke all on function private.register_customer_project(uuid, text, text, text, text, text, text, text, text, timestamp with time zone)
  from public, anon, authenticated, service_role;
grant execute on function private.register_customer_project(uuid, text, text, text, text, text, text, text, text, timestamp with time zone)
  to service_role;
revoke all on function public.register_customer_project(uuid, text, text, text, text, text, text, text, text, timestamp with time zone)
  from public, anon, authenticated, service_role;
grant execute on function public.register_customer_project(uuid, text, text, text, text, text, text, text, text, timestamp with time zone)
  to service_role;

revoke all on function public.record_customer_project_verification(uuid, integer, text, boolean, text)
  from public, anon, authenticated, service_role;
drop function public.record_customer_project_verification(uuid, integer, text, boolean, text);
revoke all on function private.record_customer_project_verification(uuid, integer, text, boolean, text)
  from public, anon, authenticated, service_role;
drop function private.record_customer_project_verification(uuid, integer, text, boolean, text);

create function private.record_customer_project_verification(
  p_tenant_id uuid,
  p_token_version integer,
  p_check text,
  p_succeeded boolean,
  p_safe_error_code text,
  p_health_protocol_version integer,
  p_health_tenant_id uuid,
  p_health_project_ref text,
  p_health_agent_version text,
  p_health_schema_version text,
  p_health_auth_attestation_version text,
  p_health_auth_attestation_digest text,
  p_health_auth_attestation_checked_at timestamp with time zone
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_project public.customer_projects%rowtype;
  v_health_matches boolean;
begin
  perform private.require_central_user_service_role();

  if p_check not in ('health', 'list_users') then
    raise exception using
      errcode = '22023',
      message = 'central_user_manager_invalid_verification_check';
  end if;

  select *
  into v_project
  from public.customer_projects
  where id = p_tenant_id
    and is_active = false
    and bearer_token_version = p_token_version
  for update;

  if not found then
    return false;
  end if;

  if not p_succeeded then
    update public.customer_projects
    set
      last_verified_token_version = null,
      last_health_status = case
        when p_check = 'health' then 'unhealthy'
        else last_health_status
      end,
      last_health_safe_error = case
        when p_check = 'health' then p_safe_error_code
        else last_health_safe_error
      end,
      last_health_protocol_version = case
        when p_check = 'health' then null
        else last_health_protocol_version
      end,
      last_health_tenant_id = case
        when p_check = 'health' then null
        else last_health_tenant_id
      end,
      last_health_project_ref = case
        when p_check = 'health' then null
        else last_health_project_ref
      end,
      last_health_agent_version = case
        when p_check = 'health' then null
        else last_health_agent_version
      end,
      last_health_schema_version = case
        when p_check = 'health' then null
        else last_health_schema_version
      end,
      last_health_auth_attestation_version = case
        when p_check = 'health' then null
        else last_health_auth_attestation_version
      end,
      last_health_auth_attestation_digest = case
        when p_check = 'health' then null
        else last_health_auth_attestation_digest
      end,
      last_health_auth_attestation_checked_at = case
        when p_check = 'health' then null
        else last_health_auth_attestation_checked_at
      end,
      last_health_checked_at = case
        when p_check = 'health' then clock_timestamp()
        else last_health_checked_at
      end,
      last_list_users_checked_at = case
        when p_check = 'list_users' then null
        else last_list_users_checked_at
      end,
      last_safe_error_code = p_safe_error_code,
      updated_at = clock_timestamp()
    where id = p_tenant_id;
    return true;
  end if;

  if p_check = 'health' then
    v_health_matches :=
      p_health_protocol_version = 1
      and p_health_tenant_id = p_tenant_id
      and p_health_project_ref = v_project.target_supabase_project_ref
      and p_health_agent_version = v_project.expected_agent_version
      and p_health_schema_version = v_project.expected_schema_version
      and p_health_auth_attestation_version = v_project.auth_attestation_version
      and p_health_auth_attestation_digest = v_project.auth_attestation_digest
      and p_health_auth_attestation_checked_at = v_project.auth_attestation_checked_at;

    if not coalesce(v_health_matches, false) then
      update public.customer_projects
      set
        last_verified_token_version = null,
        last_health_status = 'unhealthy',
        last_health_safe_error = 'health_identity_mismatch',
        last_health_protocol_version = null,
        last_health_tenant_id = null,
        last_health_project_ref = null,
        last_health_agent_version = null,
        last_health_schema_version = null,
        last_health_auth_attestation_version = null,
        last_health_auth_attestation_digest = null,
        last_health_auth_attestation_checked_at = null,
        last_health_checked_at = clock_timestamp(),
        last_safe_error_code = 'health_identity_mismatch',
        updated_at = clock_timestamp()
      where id = p_tenant_id;
      return false;
    end if;

    update public.customer_projects
    set
      last_verified_token_version = p_token_version,
      last_health_status = 'healthy',
      last_health_safe_error = null,
      last_health_protocol_version = p_health_protocol_version,
      last_health_tenant_id = p_health_tenant_id,
      last_health_project_ref = p_health_project_ref,
      last_health_agent_version = p_health_agent_version,
      last_health_schema_version = p_health_schema_version,
      last_health_auth_attestation_version = p_health_auth_attestation_version,
      last_health_auth_attestation_digest = p_health_auth_attestation_digest,
      last_health_auth_attestation_checked_at = p_health_auth_attestation_checked_at,
      last_health_checked_at = clock_timestamp(),
      last_safe_error_code = null,
      updated_at = clock_timestamp()
    where id = p_tenant_id;
    return true;
  end if;

  if p_health_protocol_version is not null
    or p_health_tenant_id is not null
    or p_health_project_ref is not null
    or p_health_agent_version is not null
    or p_health_schema_version is not null
    or p_health_auth_attestation_version is not null
    or p_health_auth_attestation_digest is not null
    or p_health_auth_attestation_checked_at is not null
  then
    raise exception using
      errcode = '22023',
      message = 'central_user_manager_list_verification_has_health_fields';
  end if;

  update public.customer_projects
  set
    last_verified_token_version = p_token_version,
    last_list_users_checked_at = clock_timestamp(),
    last_safe_error_code = null,
    updated_at = clock_timestamp()
  where id = p_tenant_id;
  return true;
end;
$$;

create function public.record_customer_project_verification(
  p_tenant_id uuid,
  p_token_version integer,
  p_check text,
  p_succeeded boolean,
  p_safe_error_code text,
  p_health_protocol_version integer,
  p_health_tenant_id uuid,
  p_health_project_ref text,
  p_health_agent_version text,
  p_health_schema_version text,
  p_health_auth_attestation_version text,
  p_health_auth_attestation_digest text,
  p_health_auth_attestation_checked_at timestamp with time zone
)
returns boolean
language sql
set search_path = pg_catalog, public, private
as $$
  select private.record_customer_project_verification(
    p_tenant_id,
    p_token_version,
    p_check,
    p_succeeded,
    p_safe_error_code,
    p_health_protocol_version,
    p_health_tenant_id,
    p_health_project_ref,
    p_health_agent_version,
    p_health_schema_version,
    p_health_auth_attestation_version,
    p_health_auth_attestation_digest,
    p_health_auth_attestation_checked_at
  );
$$;

revoke all on function private.record_customer_project_verification(uuid, integer, text, boolean, text, integer, uuid, text, text, text, text, text, timestamp with time zone)
  from public, anon, authenticated, service_role;
grant execute on function private.record_customer_project_verification(uuid, integer, text, boolean, text, integer, uuid, text, text, text, text, text, timestamp with time zone)
  to service_role;
revoke all on function public.record_customer_project_verification(uuid, integer, text, boolean, text, integer, uuid, text, text, text, text, text, timestamp with time zone)
  from public, anon, authenticated, service_role;
grant execute on function public.record_customer_project_verification(uuid, integer, text, boolean, text, integer, uuid, text, text, text, text, text, timestamp with time zone)
  to service_role;

create or replace function private.deactivate_customer_project(p_tenant_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform private.require_central_user_service_role();

  update public.customer_projects
  set
    is_active = false,
    last_verified_token_version = null,
    last_health_status = 'unknown',
    last_health_safe_error = null,
    last_health_protocol_version = null,
    last_health_tenant_id = null,
    last_health_project_ref = null,
    last_health_agent_version = null,
    last_health_schema_version = null,
    last_health_auth_attestation_version = null,
    last_health_auth_attestation_digest = null,
    last_health_auth_attestation_checked_at = null,
    last_health_checked_at = null,
    last_list_users_checked_at = null,
    updated_at = clock_timestamp()
  where id = p_tenant_id;

  return found;
end;
$$;

create or replace function private.rotate_customer_project_bearer(
  p_tenant_id uuid,
  p_expected_token_version integer,
  p_next_token_version integer,
  p_kek_version integer,
  p_ciphertext text,
  p_iv text,
  p_fingerprint text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform private.require_central_user_service_role();

  if p_next_token_version <> p_expected_token_version + 1 then
    raise exception using
      errcode = '22023',
      message = 'central_user_manager_token_version_must_increment';
  end if;

  if p_expected_token_version = 0 and p_next_token_version <> 1 then
    raise exception using
      errcode = '22023',
      message = 'central_user_manager_initial_token_version_must_be_one';
  end if;

  update public.customer_projects
  set
    is_active = false,
    bearer_token_ciphertext = p_ciphertext,
    bearer_token_iv = p_iv,
    bearer_token_version = p_next_token_version,
    bearer_token_kek_version = p_kek_version,
    bearer_token_fingerprint = p_fingerprint,
    bearer_token_updated_at = clock_timestamp(),
    last_verified_token_version = null,
    last_health_status = 'unknown',
    last_health_safe_error = null,
    last_health_protocol_version = null,
    last_health_tenant_id = null,
    last_health_project_ref = null,
    last_health_agent_version = null,
    last_health_schema_version = null,
    last_health_auth_attestation_version = null,
    last_health_auth_attestation_digest = null,
    last_health_auth_attestation_checked_at = null,
    last_health_checked_at = null,
    last_list_users_checked_at = null,
    last_safe_error_code = null,
    updated_at = clock_timestamp()
  where id = p_tenant_id
    and is_active = false
    and coalesce(bearer_token_version, 0) = p_expected_token_version;

  return found;
end;
$$;

create or replace function private.activate_customer_project(
  p_tenant_id uuid,
  p_expected_token_version integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform private.require_central_user_service_role();

  update public.customer_projects
  set is_active = true, updated_at = clock_timestamp()
  where id = p_tenant_id
    and is_active = false
    and bearer_token_version = p_expected_token_version
    and bearer_token_version = last_verified_token_version
    and last_health_status = 'healthy'
    and last_health_protocol_version = 1
    and last_health_tenant_id = id
    and last_health_project_ref = target_supabase_project_ref
    and last_health_agent_version = expected_agent_version
    and last_health_schema_version = expected_schema_version
    and last_health_auth_attestation_version = auth_attestation_version
    and last_health_auth_attestation_digest = auth_attestation_digest
    and last_health_auth_attestation_checked_at = auth_attestation_checked_at
    and last_health_checked_at >= bearer_token_updated_at
    and last_list_users_checked_at >= bearer_token_updated_at;

  return found;
end;
$$;

notify pgrst, 'reload schema';
