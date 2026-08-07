create function private.recover_failed_customer_project_token_rotation(
  p_tenant_id uuid,
  p_expected_token_version integer,
  p_expected_kek_version integer,
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
  v_remaining_dispatchable_count integer;
  v_prior_recovery_exists boolean;
begin
  perform private.require_central_user_service_role();

  if not exists (
    select 1
    from public.users
    where uid = p_actor_uid
      and role_id = 1
  ) then
    raise exception using
      errcode = '42501',
      message = 'central_user_manager_admin_required';
  end if;

  if p_tenant_id is null
    or p_actor_uid is null
    or p_event_id is null
    or p_expected_token_version is null
    or p_expected_token_version < 1
    or p_expected_kek_version is null
    or p_expected_kek_version < 1
  then
    return null;
  end if;

  select *
  into v_project
  from public.customer_projects
  where id = p_tenant_id
    and bearer_token_version = p_expected_token_version
    and bearer_token_kek_version = p_expected_kek_version
  for update;

  if not found then
    return null;
  end if;

  if v_project.is_active = false
    and v_project.provisioning_state = 'rotation_gated'
  then
    select exists (
      select 1
      from public.central_user_audit_events
      where tenant_id = p_tenant_id
        and action = 'deactivate_project'
        and outcome = 'succeeded'
        and safe_error_code = 'provider_failure'
        and operation_id is null
        and request_hash is null
        and metadata ->> 'status' = 'recovery_rotation_gate'
        and metadata ->> 'tokenVersion' = p_expected_token_version::text
        and metadata ->> 'healthStatus' = 'unhealthy'
    )
    into v_prior_recovery_exists;

    if not v_prior_recovery_exists then
      return null;
    end if;

    return jsonb_build_object(
      'outcome', 'retry',
      'tokenVersion', p_expected_token_version,
      'remainingDispatchableCount', 0
    );
  end if;

  if v_project.is_active is distinct from false
    or v_project.provisioning_state is distinct from 'token_stored'
    or v_project.last_verified_token_version is not null
    or v_project.last_health_status is distinct from 'unhealthy'
    or v_project.last_health_safe_error is distinct from 'provider_failure'
    or v_project.last_safe_error_code is distinct from 'provider_failure'
    or v_project.last_health_checked_at is null
    or v_project.bearer_token_updated_at is null
    or v_project.last_health_checked_at < v_project.bearer_token_updated_at
    or v_project.last_list_users_checked_at is not null
    or v_project.last_health_protocol_version is not null
    or v_project.last_health_tenant_id is not null
    or v_project.last_health_project_ref is not null
    or v_project.last_health_agent_version is not null
    or v_project.last_health_schema_version is not null
    or v_project.last_health_auth_attestation_version is not null
    or v_project.last_health_auth_attestation_digest is not null
    or v_project.last_health_auth_attestation_checked_at is not null
  then
    return null;
  end if;

  select count(*)
  into v_remaining_dispatchable_count
  from public.user_management_operations
  where tenant_id = p_tenant_id
    and status in ('received', 'dispatching', 'in_progress', 'needs_review');

  if v_remaining_dispatchable_count <> 0 then
    return null;
  end if;

  update public.customer_projects
  set
    provisioning_state = 'rotation_gated',
    updated_at = clock_timestamp()
  where id = p_tenant_id;

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
    'deactivate_project',
    'succeeded',
    'provider_failure',
    null,
    jsonb_build_object(
      'status', 'recovery_rotation_gate',
      'tokenVersion', p_expected_token_version,
      'healthStatus', 'unhealthy'
    )
  );

  return jsonb_build_object(
    'outcome', 'recovered',
    'tokenVersion', p_expected_token_version,
    'remainingDispatchableCount', v_remaining_dispatchable_count
  );
end;
$$;

create function public.recover_failed_customer_project_token_rotation(
  p_tenant_id uuid,
  p_expected_token_version integer,
  p_expected_kek_version integer,
  p_actor_uid uuid,
  p_event_id uuid
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public, private
as $$
  select private.recover_failed_customer_project_token_rotation(
    p_tenant_id,
    p_expected_token_version,
    p_expected_kek_version,
    p_actor_uid,
    p_event_id
  );
$$;

revoke all on function private.recover_failed_customer_project_token_rotation(
  uuid, integer, integer, uuid, uuid
) from public, anon, authenticated, service_role;

revoke all on function public.recover_failed_customer_project_token_rotation(
  uuid, integer, integer, uuid, uuid
) from public, anon, authenticated, service_role;

grant execute on function public.recover_failed_customer_project_token_rotation(
  uuid, integer, integer, uuid, uuid
) to service_role;

notify pgrst, 'reload schema';
