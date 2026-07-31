create or replace function private.record_customer_project_verification(
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
    and bearer_token_version = p_token_version
    and (
      (is_active = false and provisioning_state = 'token_stored')
      or (is_active = true and provisioning_state = 'completed')
    )
  for update;

  if not found then
    return false;
  end if;

  if not p_succeeded then
    update public.customer_projects
    set
      is_active = false,
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
        is_active = false,
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

create or replace function private.begin_customer_project_token_rotation(
  p_tenant_id uuid,
  p_actor_uid uuid,
  p_event_id uuid,
  p_expected_token_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_project public.customer_projects%rowtype;
  v_operation public.user_management_operations%rowtype;
  v_failed_safe_count integer := 0;
  v_quarantined_count integer := 0;
  v_remaining_count integer := 0;
begin
  perform private.require_central_user_service_role();

  select *
  into v_project
  from public.customer_projects
  where id = p_tenant_id
    and bearer_token_version = p_expected_token_version
    and (
      is_active = true
      or (is_active = false and provisioning_state = 'completed')
    )
  for update;

  if not found then
    return null;
  end if;

  update public.customer_projects
  set
    is_active = false,
    provisioning_state = 'rotation_gated',
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

  for v_operation in
    update public.user_management_operations
    set
      status = 'failed_safe',
      safe_result = null,
      safe_error_code = 'project_unavailable',
      completed_at = clock_timestamp(),
      updated_at = clock_timestamp()
    where tenant_id = p_tenant_id
      and status = 'received'
    returning *
  loop
    v_failed_safe_count := v_failed_safe_count + 1;
    insert into public.central_user_audit_events (
      event_id, operation_id, tenant_id, actor_uid, action, outcome,
      safe_error_code, request_hash, metadata
    )
    values (
      gen_random_uuid(), v_operation.operation_id, p_tenant_id, p_actor_uid,
      v_operation.action, 'failed_safe', 'project_unavailable',
      v_operation.request_hash, jsonb_build_object('status', 'token_rotation_gate')
    );
  end loop;

  for v_operation in
    update public.user_management_operations
    set
      status = 'quarantined',
      safe_result = null,
      safe_error_code = 'operation_ambiguous',
      completed_at = null,
      updated_at = clock_timestamp()
    where tenant_id = p_tenant_id
      and status in ('dispatching', 'in_progress', 'needs_review')
    returning *
  loop
    v_quarantined_count := v_quarantined_count + 1;
    insert into public.central_user_audit_events (
      event_id, operation_id, tenant_id, actor_uid, action, outcome,
      safe_error_code, request_hash, metadata
    )
    values (
      gen_random_uuid(), v_operation.operation_id, p_tenant_id, p_actor_uid,
      v_operation.action, 'quarantined', 'operation_ambiguous',
      v_operation.request_hash, jsonb_build_object('status', 'token_rotation_gate')
    );
  end loop;

  insert into public.central_user_audit_events (
    event_id, operation_id, tenant_id, actor_uid, action, outcome,
    safe_error_code, request_hash, metadata
  )
  values (
    p_event_id, null, p_tenant_id, p_actor_uid, 'deactivate_project',
    'succeeded', null, null, jsonb_build_object('status', 'token_rotation_gate')
  );

  select count(*)
  into v_remaining_count
  from public.user_management_operations
  where tenant_id = p_tenant_id
    and status in ('received', 'dispatching', 'in_progress', 'needs_review');

  return jsonb_build_object(
    'failedSafeCount', v_failed_safe_count,
    'quarantinedCount', v_quarantined_count,
    'remainingDispatchableCount', v_remaining_count
  );
end;
$$;

revoke all on function private.record_customer_project_verification(
  uuid,
  integer,
  text,
  boolean,
  text,
  integer,
  uuid,
  text,
  text,
  text,
  text,
  text,
  timestamp with time zone
) from public, anon, authenticated, service_role;

grant execute on function private.record_customer_project_verification(
  uuid,
  integer,
  text,
  boolean,
  text,
  integer,
  uuid,
  text,
  text,
  text,
  text,
  text,
  timestamp with time zone
) to service_role;

notify pgrst, 'reload schema';
