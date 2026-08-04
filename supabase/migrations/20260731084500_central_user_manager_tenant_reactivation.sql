alter table public.customer_projects
  drop constraint customer_projects_provisioning_state;

alter table public.customer_projects
  add column reactivation_attempt_id uuid,
  add column reactivation_started_at timestamp with time zone;

alter table public.customer_projects
  add constraint customer_projects_provisioning_state check (
    provisioning_state is null
    or provisioning_state in (
      'registered',
      'rotation_gated',
      'token_stored',
      'completed',
      'reactivation_verifying'
    )
  ),
  add constraint customer_projects_reactivation_attempt check (
    (
      provisioning_state = 'reactivation_verifying'
      and reactivation_attempt_id is not null
      and reactivation_started_at is not null
    )
    or (
      provisioning_state is distinct from 'reactivation_verifying'
      and reactivation_attempt_id is null
      and reactivation_started_at is null
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
  last_health_auth_attestation_checked_at,
  provisioning_state
from public.customer_projects;

revoke all privileges on table public.central_user_manager_projects
  from public, anon, authenticated, service_role;
grant select on public.central_user_manager_projects to service_role;

create function private.begin_customer_project_reactivation(
  p_tenant_id uuid,
  p_attempt_id uuid,
  p_expected_token_version integer,
  p_actor_uid uuid,
  p_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_project public.customer_projects%rowtype;
  v_pending_count integer;
  v_now timestamp with time zone := clock_timestamp();
  v_outcome text;
begin
  perform private.require_central_user_service_role();

  if p_tenant_id is null
    or p_attempt_id is null
    or p_expected_token_version is null
    or p_expected_token_version < 1
    or p_actor_uid is null
    or p_event_id is null
    or not exists (
      select 1
      from public.users
      where uid = p_actor_uid
        and role_id = 1
    )
  then
    return null;
  end if;

  select *
  into v_project
  from public.customer_projects
  where id = p_tenant_id
    and is_active = false
    and bearer_token_version = p_expected_token_version
  for update;

  if not found then
    return null;
  end if;

  select count(*)
  into v_pending_count
  from public.user_management_operations
  where tenant_id = p_tenant_id
    and status in ('received', 'dispatching', 'in_progress', 'needs_review');

  if v_pending_count <> 0 then
    return null;
  end if;

  if v_project.provisioning_state = 'reactivation_verifying'
    and v_project.reactivation_attempt_id = p_attempt_id
    and v_project.reactivation_started_at is not null
  then
    v_outcome := 'retry';
  elsif v_project.provisioning_state = 'reactivation_verifying'
    and v_project.reactivation_started_at >= v_now - interval '5 minutes'
  then
    v_outcome := 'conflict';
  elsif (
      v_project.provisioning_state = 'reactivation_verifying'
      and v_project.reactivation_started_at < v_now - interval '5 minutes'
    )
    or (
      v_project.provisioning_state = 'completed'
      and v_project.last_verified_token_version is null
      and (
        v_project.last_health_status = 'unhealthy'
        or (
          v_project.last_health_status = 'healthy'
          and v_project.last_safe_error_code is not null
        )
      )
    )
  then
    update public.customer_projects
    set
      provisioning_state = 'reactivation_verifying',
      reactivation_attempt_id = p_attempt_id,
      reactivation_started_at = v_now,
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
      updated_at = v_now
    where id = p_tenant_id
    returning * into strict v_project;
    v_outcome := 'received';
  else
    return null;
  end if;

  insert into public.central_user_audit_events (
    event_id,
    operation_id,
    tenant_id,
    actor_uid,
    action,
    outcome,
    safe_error_code,
    request_hash,
    metadata
  )
  values (
    p_event_id,
    null,
    p_tenant_id,
    p_actor_uid,
    'verify_project',
    v_outcome,
    case when v_outcome = 'conflict' then 'operation_conflict' else null end,
    null,
    jsonb_build_object(
      'status', 'reactivation_verifying',
      'tokenVersion', p_expected_token_version
    )
  );

  if v_outcome = 'conflict' then
    return jsonb_build_object('outcome', v_outcome);
  end if;

  return jsonb_build_object(
    'outcome', v_outcome,
    'attemptId', v_project.reactivation_attempt_id,
    'tokenVersion', v_project.bearer_token_version
  );
end;
$$;

create function public.begin_customer_project_reactivation(
  p_tenant_id uuid,
  p_attempt_id uuid,
  p_expected_token_version integer,
  p_actor_uid uuid,
  p_event_id uuid
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public, private
as $$
  select private.begin_customer_project_reactivation(
    p_tenant_id,
    p_attempt_id,
    p_expected_token_version,
    p_actor_uid,
    p_event_id
  );
$$;

create function private.record_customer_project_reactivation_verification(
  p_tenant_id uuid,
  p_attempt_id uuid,
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
  v_now timestamp with time zone := clock_timestamp();
begin
  perform private.require_central_user_service_role();

  if p_tenant_id is null
    or p_attempt_id is null
    or p_token_version is null
    or p_token_version < 1
    or p_check not in ('health', 'list_users')
    or p_succeeded is null
    or (p_succeeded and p_safe_error_code is not null)
    or (not p_succeeded and p_safe_error_code is null)
  then
    return false;
  end if;

  select *
  into v_project
  from public.customer_projects
  where id = p_tenant_id
    and is_active = false
    and provisioning_state = 'reactivation_verifying'
    and reactivation_attempt_id = p_attempt_id
    and bearer_token_version = p_token_version
  for update;

  if not found then
    return false;
  end if;

  if not p_succeeded then
    update public.customer_projects
    set
      provisioning_state = 'completed',
      reactivation_attempt_id = null,
      reactivation_started_at = null,
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
        when p_check = 'health' then v_now
        else last_health_checked_at
      end,
      last_list_users_checked_at = case
        when p_check = 'list_users' then null
        else last_list_users_checked_at
      end,
      last_safe_error_code = p_safe_error_code,
      updated_at = v_now
    where id = p_tenant_id
      and reactivation_attempt_id = p_attempt_id;
    return found;
  end if;

  if p_check = 'health' then
    v_health_matches :=
      p_health_protocol_version = 1
      and p_health_tenant_id = p_tenant_id
      and p_health_project_ref = v_project.target_supabase_project_ref
      and p_health_agent_version = v_project.expected_agent_version
      and p_health_schema_version = v_project.expected_schema_version
      and p_health_auth_attestation_version =
        v_project.auth_attestation_version
      and p_health_auth_attestation_digest =
        v_project.auth_attestation_digest
      and p_health_auth_attestation_checked_at =
        v_project.auth_attestation_checked_at;

    if not coalesce(v_health_matches, false) then
      update public.customer_projects
      set
        provisioning_state = 'completed',
        reactivation_attempt_id = null,
        reactivation_started_at = null,
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
        last_health_checked_at = v_now,
        last_safe_error_code = 'health_identity_mismatch',
        updated_at = v_now
      where id = p_tenant_id
        and reactivation_attempt_id = p_attempt_id;
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
      last_health_auth_attestation_version =
        p_health_auth_attestation_version,
      last_health_auth_attestation_digest = p_health_auth_attestation_digest,
      last_health_auth_attestation_checked_at =
        p_health_auth_attestation_checked_at,
      last_health_checked_at = v_now,
      last_safe_error_code = null,
      updated_at = v_now
    where id = p_tenant_id
      and reactivation_attempt_id = p_attempt_id;
    return found;
  end if;

  if p_health_protocol_version is not null
    or p_health_tenant_id is not null
    or p_health_project_ref is not null
    or p_health_agent_version is not null
    or p_health_schema_version is not null
    or p_health_auth_attestation_version is not null
    or p_health_auth_attestation_digest is not null
    or p_health_auth_attestation_checked_at is not null
    or v_project.last_verified_token_version is distinct from p_token_version
    or v_project.last_health_status is distinct from 'healthy'
    or v_project.last_health_checked_at is null
    or v_project.last_health_checked_at < v_project.reactivation_started_at
  then
    return false;
  end if;

  update public.customer_projects
  set
    last_verified_token_version = p_token_version,
    last_list_users_checked_at = v_now,
    last_safe_error_code = null,
    updated_at = v_now
  where id = p_tenant_id
    and reactivation_attempt_id = p_attempt_id;
  return found;
end;
$$;

create function public.record_customer_project_reactivation_verification(
  p_tenant_id uuid,
  p_attempt_id uuid,
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
security definer
set search_path = pg_catalog, public, private
as $$
  select private.record_customer_project_reactivation_verification(
    p_tenant_id,
    p_attempt_id,
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

create function private.activate_customer_project_after_reverification(
  p_tenant_id uuid,
  p_attempt_id uuid,
  p_expected_token_version integer,
  p_actor_uid uuid,
  p_event_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_pending_count integer;
begin
  perform private.require_central_user_service_role();

  if p_tenant_id is null
    or p_attempt_id is null
    or p_expected_token_version is null
    or p_expected_token_version < 1
    or p_actor_uid is null
    or p_event_id is null
    or not exists (
      select 1
      from public.users
      where uid = p_actor_uid
        and role_id = 1
    )
  then
    return false;
  end if;

  select count(*)
  into v_pending_count
  from public.user_management_operations
  where tenant_id = p_tenant_id
    and status in ('received', 'dispatching', 'in_progress', 'needs_review');

  if v_pending_count <> 0 then
    return false;
  end if;

  update public.customer_projects
  set is_active = true,
      provisioning_state = 'completed',
      reactivation_attempt_id = null,
      reactivation_started_at = null,
      updated_at = clock_timestamp()
  where id = p_tenant_id
    and is_active = false
    and provisioning_state = 'reactivation_verifying'
    and reactivation_attempt_id = p_attempt_id
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
    and last_list_users_checked_at >= bearer_token_updated_at
    and last_health_checked_at >= reactivation_started_at
    and last_list_users_checked_at >= reactivation_started_at;

  if not found then
    return false;
  end if;

  insert into public.central_user_audit_events (
    event_id,
    operation_id,
    tenant_id,
    actor_uid,
    action,
    outcome,
    safe_error_code,
    request_hash,
    metadata
  )
  values (
    p_event_id,
    null,
    p_tenant_id,
    p_actor_uid,
    'activate_project',
    'succeeded',
    null,
    null,
    jsonb_build_object(
      'status', 'reactivation_reverified',
      'tokenVersion', p_expected_token_version
    )
  );

  return true;
end;
$$;

create function public.activate_customer_project_after_reverification(
  p_tenant_id uuid,
  p_attempt_id uuid,
  p_expected_token_version integer,
  p_actor_uid uuid,
  p_event_id uuid
)
returns boolean
language sql
security definer
set search_path = pg_catalog, public, private
as $$
  select private.activate_customer_project_after_reverification(
    p_tenant_id,
    p_attempt_id,
    p_expected_token_version,
    p_actor_uid,
    p_event_id
  );
$$;

revoke all on function private.begin_customer_project_reactivation(
  uuid, uuid, integer, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.begin_customer_project_reactivation(
  uuid, uuid, integer, uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.begin_customer_project_reactivation(
  uuid, uuid, integer, uuid, uuid
) to service_role;

revoke all on function private.record_customer_project_reactivation_verification(
  uuid, uuid, integer, text, boolean, text, integer, uuid, text, text, text,
  text, text, timestamp with time zone
) from public, anon, authenticated, service_role;
revoke all on function public.record_customer_project_reactivation_verification(
  uuid, uuid, integer, text, boolean, text, integer, uuid, text, text, text,
  text, text, timestamp with time zone
) from public, anon, authenticated, service_role;
grant execute on function public.record_customer_project_reactivation_verification(
  uuid, uuid, integer, text, boolean, text, integer, uuid, text, text, text,
  text, text, timestamp with time zone
) to service_role;

revoke all on function private.activate_customer_project_after_reverification(
  uuid, uuid, integer, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.activate_customer_project_after_reverification(
  uuid, uuid, integer, uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.activate_customer_project_after_reverification(
  uuid, uuid, integer, uuid, uuid
) to service_role;

notify pgrst, 'reload schema';
